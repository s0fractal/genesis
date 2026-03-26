// OMEGA-64 Era 300: Minimal Deno WebRTC Signaling Relay
// Used to form multi-instance Torus mesh topology

const PORT = 9091;
const clients = new Map<string, WebSocket>();
let nextPeerId = 1;

Deno.serve({ port: PORT }, (req) => {
    if (req.headers.get("upgrade") != "websocket") {
        return new Response("OMEGA-64 WebRTC Signaling Relay (Era 300). Use WebSockets.", { status: 426 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const peerId = "peer_" + nextPeerId++;

    socket.onopen = () => {
        console.log(`[SIGNAL] ✅ Peer Connected: ${peerId}`);
        clients.set(peerId, socket);
        
        // Tell the new peer its identity
        socket.send(JSON.stringify({ type: "HELLO", peerId }));

        // Broadcast to all other peers that a new node joined
        for (const [id, client] of clients.entries()) {
            if (id !== peerId && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "PEER_JOINED", peerId }));
            }
        }
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.target && clients.has(data.target)) {
                // Relay WebRTC signaling (SDP / ICE candidates)
                const targetSocket = clients.get(data.target)!;
                if (targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify({ ...data, from: peerId }));
                }
            } else if (data.type === "BROADCAST") {
                // Optional fallback non-webrtc gossip relay
                for (const [id, client] of clients.entries()) {
                    if (id !== peerId && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ ...data, from: peerId }));
                    }
                }
            }
        } catch (e) {
            console.warn(`[SIGNAL] Invalid message from ${peerId}:`, e);
        }
    };

    socket.onclose = () => {
        console.log(`[SIGNAL] ❌ Peer Disconnected: ${peerId}`);
        clients.delete(peerId);
        for (const [id, client] of clients.entries()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "PEER_LEFT", peerId }));
            }
        }
    };

    return response;
});

console.log(`[OMEGA-64] WebRTC Signaling Relay active on ws://localhost:${PORT}`);
