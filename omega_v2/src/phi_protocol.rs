//! Φ-Маніфест: Phi Protocol — Міст між OMEGA фізикою та Liquid онтологією
//!
//! Цей модуль визначає уніфікований формат повідомлень (PhiMessage),
//! через який OMEGA-64 публікує свій стан для зовнішніх спостерігачів
//! (Liquid Σ-нейрони, TypeScript HUD, P2P мости).
//!
//! Формат: zero-allocation, repr(C), 16 bytes per message.
//! Комунікація через lock-free ring buffer (PHI_MESSAGE_BUFFER).

use crate::agent::PhaseAgentMinimal;

// --- Message Type Constants ---
pub const PHI_MSG_HEARTBEAT: u8 = 0; // Golden Trace + absolute_tick
pub const PHI_MSG_COMPOST: u8 = 1; // Агент помер → його genome йде в compost
pub const PHI_MSG_INTENT: u8 = 2; // Інтент як φ (не координати)
pub const PHI_MSG_DELTA: u8 = 3; // Delta snapshot broadcast
pub const PHI_MSG_GOVERNANCE: u8 = 4; // Повідомлення Сенату (verdict)

/// Уніфіковане φ-повідомлення.
/// 16 байтів — ідеально для zero-copy у SharedArrayBuffer.
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PhiMessage {
    /// Тип повідомлення (HEARTBEAT / COMPOST / INTENT / DELTA)
    pub msg_type: u8,
    /// q_phase рівня, з якого надходить повідомлення (0..=10)
    pub q_phase: u8,
    /// Padding для 4-byte alignment
    pub _pad: u16,
    /// Фазовий кут φ — семантична адреса джерела
    pub phi: u32,
    /// Енергія ρ повідомлення (вага при роутингу)
    pub energy: u32,
    /// Payload — інтерпретація залежить від msg_type:
    /// HEARTBEAT: absolute_tick (u32) | trace_hash (u32)
    /// COMPOST:   agent_id (u64)
    /// INTENT:    intent_id (u32) | op_mode (u32)
    /// DELTA:     delta_count (u32) | reserved (u32)
    /// GOVERNANCE:verdict (u32) | anchor (u32)
    pub payload: u64,
}

impl PhiMessage {
    pub const fn new(msg_type: u8, q_phase: u8, phi: u32, energy: u32, payload: u64) -> Self {
        Self {
            msg_type,
            q_phase,
            _pad: 0,
            phi,
            energy,
            payload,
        }
    }

    /// Кодує Golden Trace як heartbeat повідомлення.
    /// Liquid бачить це як "пульс" фізичного шару.
    pub fn encode_heartbeat(trace: u32, tick: u32, q_phase: u8) -> Self {
        let payload = ((tick as u64) << 32) | (trace as u64);
        Self::new(PHI_MSG_HEARTBEAT, q_phase, trace, 0xFFFFFFFF, payload)
    }

    /// Кодує подію compost (смерть агента).
    /// Liquid може перетворити це на новий Σ-нейрон.
    /// Payload layout: (agent_id << 32) | genome — передає genome і agent_id в одному u64.
    pub fn encode_compost(agent: &PhaseAgentMinimal, agent_id: u64) -> Self {
        let payload = (agent_id << 32) | (agent.genome as u64);
        Self::new(PHI_MSG_COMPOST, 0, agent.phase, agent.energy, payload)
    }

    /// Кодує інтент як φ-повідомлення.
    /// Замість координат (x, y) — фазовий кут і енергія.
    pub fn encode_intent(intent_phase: u32, intent_energy: u32, intent_id: u32) -> Self {
        let payload = (intent_id as u64) << 32;
        Self::new(PHI_MSG_INTENT, 0, intent_phase, intent_energy, payload)
    }

    /// Кодує delta snapshot broadcast.
    pub fn encode_delta(delta_count: u32, tick: u32) -> Self {
        let payload = ((tick as u64) << 32) | (delta_count as u64);
        Self::new(PHI_MSG_DELTA, 0, 0, 0xFFFF0000 | delta_count, payload)
    }

    /// Кодує повідомлення Сенату.
    pub fn encode_governance(anchor: u32, verdict: u32, tick: u32) -> Self {
        let payload = ((verdict as u64) << 32) | (anchor as u64);
        Self::new(PHI_MSG_GOVERNANCE, 0, tick, 0xFFFFFFFF, payload)
    }

    /// Декодує heartbeat payload → (trace, tick)
    pub fn decode_heartbeat(&self) -> Option<(u32, u32)> {
        if self.msg_type != PHI_MSG_HEARTBEAT {
            return None;
        }
        let trace = self.payload as u32;
        let tick = (self.payload >> 32) as u32;
        Some((trace, tick))
    }

    /// Декодує compost payload → (genome, agent_id).
    /// Payload layout: (agent_id << 32) | genome
    pub fn decode_compost(&self) -> Option<(u32, u64)> {
        if self.msg_type != PHI_MSG_COMPOST {
            return None;
        }
        let genome = self.payload as u32;
        let agent_id = self.payload >> 32;
        Some((genome, agent_id))
    }

    /// Декодує intent payload → (intent_phase, intent_energy, intent_id)
    pub fn decode_intent(&self) -> Option<(u32, u32, u32)> {
        if self.msg_type != PHI_MSG_INTENT {
            return None;
        }
        let intent_id = (self.payload >> 32) as u32;
        Some((self.phi, self.energy, intent_id))
    }

    /// Декодує delta payload → (delta_count, tick)
    pub fn decode_delta(&self) -> Option<(u32, u32)> {
        if self.msg_type != PHI_MSG_DELTA {
            return None;
        }
        let count = self.payload as u32;
        let tick = (self.payload >> 32) as u32;
        Some((count, tick))
    }

    /// Декодує governance payload → (anchor, verdict)
    pub fn decode_governance(&self) -> Option<(u32, u32)> {
        if self.msg_type != PHI_MSG_GOVERNANCE {
            return None;
        }
        let anchor = self.payload as u32;
        let verdict = (self.payload >> 32) as u32;
        Some((anchor, verdict))
    }
}

// --- Lock-Free Ring Buffer for Phi Messages ---

/// Кількість повідомлень у кільцевому буфері.
/// 256 × 16 bytes = 4KB — поміщається в L1 cache.
pub const PHI_BUFFER_SIZE: usize = 256;

/// Кільцевий буфер φ-повідомлень.
/// OMEGA пише з одного боку, зовнішні спостерігачі читають з іншого.
#[repr(C)]
pub struct PhiMessageBuffer {
    /// Кільцевий масив повідомлень.
    pub messages: [PhiMessage; PHI_BUFFER_SIZE],
    /// Індекс наступного запису (write head).
    pub write_head: u32,
    /// Індекс наступного читання (read head).
    /// NOTE: читач сам оновлює read_head. Немає mutex.
    pub read_head: u32,
    /// Лічильник dropped messages (переповнення буфера).
    pub drops: u32,
}

impl PhiMessageBuffer {
    pub const fn new() -> Self {
        Self {
            messages: [PhiMessage::new(0, 0, 0, 0, 0); PHI_BUFFER_SIZE],
            write_head: 0,
            read_head: 0,
            drops: 0,
        }
    }

    /// Записує повідомлення у буфер.
    /// Якщо буфер переповнений — найстаріше повідомлення перезаписується.
    pub fn push(&mut self, msg: PhiMessage) {
        let idx = (self.write_head as usize) % PHI_BUFFER_SIZE;
        self.messages[idx] = msg;
        self.write_head = self.write_head.wrapping_add(1);

        // Якщо write обігнав read — read зсувається (drop oldest)
        let distance = self.write_head.wrapping_sub(self.read_head);
        if distance > PHI_BUFFER_SIZE as u32 {
            self.read_head = self.read_head.wrapping_add(1);
            self.drops = self.drops.wrapping_add(1);
        }
    }

    /// Забирає одне повідомлення з буфера (FIFO).
    /// Повертає None, якщо буфер порожній.
    pub fn pop(&mut self) -> Option<PhiMessage> {
        if self.read_head == self.write_head {
            return None;
        }
        let idx = (self.read_head as usize) % PHI_BUFFER_SIZE;
        let msg = self.messages[idx];
        self.read_head = self.read_head.wrapping_add(1);
        Some(msg)
    }

    /// Повертає кількість непрочитаних повідомлень.
    pub fn len(&self) -> u32 {
        self.write_head.wrapping_sub(self.read_head)
    }

    /// Повертає true, якщо буфер порожній.
    pub fn is_empty(&self) -> bool {
        self.read_head == self.write_head
    }

    /// Peek на останнє повідомлення без видалення.
    pub fn peek_latest(&self) -> Option<PhiMessage> {
        if self.is_empty() {
            return None;
        }
        let idx = ((self.write_head.wrapping_sub(1)) as usize) % PHI_BUFFER_SIZE;
        Some(self.messages[idx])
    }

    /// Peek на N-не повідомлення з хвоста (для sampling).
    pub fn peek_nth(&self, n: usize) -> Option<PhiMessage> {
        let available = self.len() as usize;
        if n >= available {
            return None;
        }
        let idx =
            ((self.write_head.wrapping_sub(1).wrapping_sub(n as u32)) as usize) % PHI_BUFFER_SIZE;
        Some(self.messages[idx])
    }

    /// Скидає буфер до початкового стану (для тестів).
    pub fn reset(&mut self) {
        self.write_head = 0;
        self.read_head = 0;
        self.drops = 0;
    }
}

impl Default for PhiMessageBuffer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_roundtrip_heartbeat() {
        let msg = PhiMessage::encode_heartbeat(0xDEADBEEF, 42, 7);
        assert_eq!(msg.msg_type, PHI_MSG_HEARTBEAT);
        assert_eq!(msg.phi, 0xDEADBEEF);
        assert_eq!(msg.energy, 0xFFFFFFFF);

        let (trace, tick) = msg.decode_heartbeat().unwrap();
        assert_eq!(trace, 0xDEADBEEF);
        assert_eq!(tick, 42);
    }

    #[test]
    fn test_message_compost_payload() {
        let agent = PhaseAgentMinimal {
            phase: 123,
            energy: 456,
            base_freq: 789,
            state_flags: 0,
            genome: 0xCAFEBABE,
            memory: [0, 0, 0],
        };
        let msg = PhiMessage::encode_compost(&agent, 0xF00D);
        assert_eq!(msg.msg_type, PHI_MSG_COMPOST);
        assert_eq!(msg.phi, 123);
        assert_eq!(msg.energy, 456);

        let (genome, agent_id) = msg.decode_compost().unwrap();
        assert_eq!(genome, 0xCAFEBABE);
        assert_eq!(agent_id, 0xF00D);
    }

    #[test]
    fn test_message_intent_decode() {
        let msg = PhiMessage::encode_intent(64, 1000, 7);
        let (phase, energy, id) = msg.decode_intent().unwrap();
        assert_eq!(phase, 64);
        assert_eq!(energy, 1000);
        assert_eq!(id, 7);
    }

    #[test]
    fn test_message_wrong_decode_returns_none() {
        let msg = PhiMessage::encode_heartbeat(0, 0, 0);
        assert!(msg.decode_compost().is_none());
        assert!(msg.decode_intent().is_none());
        assert!(msg.decode_governance().is_none());
    }

    #[test]
    fn test_message_governance_decode() {
        let msg = PhiMessage::encode_governance(0x12345678, 1, 42);
        assert_eq!(msg.msg_type, PHI_MSG_GOVERNANCE);
        assert_eq!(msg.phi, 42);
        let (anchor, verdict) = msg.decode_governance().unwrap();
        assert_eq!(anchor, 0x12345678);
        assert_eq!(verdict, 1);
    }

    #[test]
    fn test_buffer_fifo() {
        let mut buf = PhiMessageBuffer::new();
        assert!(buf.is_empty());

        buf.push(PhiMessage::encode_heartbeat(1, 1, 0));
        buf.push(PhiMessage::encode_heartbeat(2, 2, 0));
        assert_eq!(buf.len(), 2);

        let m1 = buf.pop().unwrap();
        assert_eq!(m1.decode_heartbeat().unwrap().0, 1);
        let m2 = buf.pop().unwrap();
        assert_eq!(m2.decode_heartbeat().unwrap().0, 2);
        assert!(buf.is_empty());
    }

    #[test]
    fn test_buffer_overflow_drops_oldest() {
        let mut buf = PhiMessageBuffer::new();
        for i in 0..(PHI_BUFFER_SIZE + 10) as u32 {
            buf.push(PhiMessage::encode_heartbeat(i, i, 0));
        }
        // Буфер має містити останні 256 повідомлень
        assert_eq!(buf.len(), PHI_BUFFER_SIZE as u32);
        assert_eq!(buf.drops, 10);

        // Перше доступне повідомлення — 10 (0..9 випали)
        let first = buf.pop().unwrap();
        assert_eq!(first.decode_heartbeat().unwrap().0, 10);
    }

    #[test]
    fn test_buffer_peek_latest() {
        let mut buf = PhiMessageBuffer::new();
        buf.push(PhiMessage::encode_heartbeat(111, 0, 0));
        buf.push(PhiMessage::encode_heartbeat(222, 0, 0));

        let latest = buf.peek_latest().unwrap();
        assert_eq!(latest.decode_heartbeat().unwrap().0, 222);
        // Peek не видаляє
        assert_eq!(buf.len(), 2);
    }

    #[test]
    fn test_buffer_reset() {
        let mut buf = PhiMessageBuffer::new();
        buf.push(PhiMessage::encode_heartbeat(1, 1, 0));
        buf.push(PhiMessage::encode_heartbeat(2, 2, 0));
        assert_eq!(buf.len(), 2);
        buf.reset();
        assert!(buf.is_empty());
        assert_eq!(buf.drops, 0);
        // After reset, push continues from start
        buf.push(PhiMessage::encode_heartbeat(3, 3, 0));
        assert_eq!(buf.len(), 1);
        let m = buf.pop().unwrap();
        assert_eq!(m.decode_heartbeat().unwrap().0, 3);
    }

    #[test]
    fn test_buffer_size_is_4kb() {
        // 256 messages × 16 bytes = 4096 bytes
        let buf = PhiMessageBuffer::new();
        let size = core::mem::size_of_val(&buf);
        // exact size depends on alignment, but should be close to 4096 + headers
        assert!(size >= 4096);
    }
}
