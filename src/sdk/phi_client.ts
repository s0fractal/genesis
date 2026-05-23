/**
 * Φ-SDK: Passive WebRTC Client
 * Allows read-only observation of an OMEGA-64 peer network.
 */
import {
  PhaseAgentMinimal,
  PhaseAgentParser,
  SignalStore,
  SignalStoreParser,
} from "./phi_types.ts";
import { calculateGoldenTrace } from "./phi_crypto.ts";

export interface WitnessData {
  timestamp: number;
  agentCount: number;
  goldenTrace: string;
  peersConnected: number;
}

export type PayloadHandler = (type: number | string, payload: any) => void;

export class PhiClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private handlers: Map<number | string, PayloadHandler[]> = new Map();

  public witnessHistory: WitnessData[] = [];
  public connected: boolean = false;

  constructor() {}

  /**
   * Connects to a known signaling server or directly via an SDP offer.
   * This is a minimal stub representing the future P2P bootstrapping mechanism.
   */
  public async connect(
    signalingUrl: string,
    targetPeerId: string,
  ): Promise<void> {
    // 1. Setup WebSocket for signaling and broadcast fallback
    const ws = new WebSocket(signalingUrl);
    ws.onopen = () => {
      console.log(`[Φ-SDK] Signaling WebSocket connected.`);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "PLASMID_BROADCAST" && msg.payload) {
          this.dispatchEvent("plasmid", msg.payload);
        } else if (msg.type === "SPORE_TELEMETRY") {
          this.dispatchEvent("spore", msg);
        }
      } catch (e) {
        // Ignore non-JSON or malformed messages
      }
    };

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection?.iceConnectionState === "connected") {
        this.connected = true;
        console.log(`[Φ-SDK] Connected to peer: ${targetPeerId}`);
      }
    };

    // For a passive observer, we only receive data channels.
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    // In a real implementation, you would perform WebRTC signaling here.
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.binaryType = "arraybuffer";

    this.dataChannel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const buffer = new Uint8Array(event.data);
        if (buffer.length < 1) return;

        const frameType = buffer[0];
        const payload = buffer.subarray(1);

        this.dispatchEvent(frameType, payload);
      }
    };
  }

  /**
   * Registers a listener for specific OMEGA-64 frame types or string events.
   * e.g. 5 = Snapshot Digest, "plasmid" = JSON Senate Vote
   */
  public onFrame(frameType: number | string, handler: PayloadHandler) {
    if (!this.handlers.has(frameType)) {
      this.handlers.set(frameType, []);
    }
    this.handlers.get(frameType)!.push(handler);
  }

  private dispatchEvent(frameType: number | string, payload: any) {
    const typeHandlers = this.handlers.get(frameType);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        handler(frameType, payload);
      }
    }
  }

  /**
   * Helper to process a raw binary export of an OMEGA state buffer.
   * Extracts agents, counts them, and calculates the cryptographic trace.
   */
  public processWitnessSnapshot(
    buffer: Uint8Array,
    signalStoreBuffer: Uint8Array,
  ): WitnessData {
    const signalView = new DataView(
      signalStoreBuffer.buffer,
      signalStoreBuffer.byteOffset,
      signalStoreBuffer.byteLength,
    );
    const signals = SignalStoreParser.parse(signalView, 0);

    const hashNum = calculateGoldenTrace(buffer, signals.activeAgentCount);
    const hashStr = hashNum.toString(16).toUpperCase().padStart(8, "0");

    const data: WitnessData = {
      timestamp: Date.now(),
      agentCount: signals.activeAgentCount,
      goldenTrace: hashStr,
      peersConnected: this.connected ? 1 : 0,
    };

    this.witnessHistory.push(data);
    return data;
  }
}
