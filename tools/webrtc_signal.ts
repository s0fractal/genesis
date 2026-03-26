// OMEGA-64 Era 400: Global Edge DHT Signaling Relay
// Used to form K-Degree bounded Torus sparse-mesh topology

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

        // Era 400: K-Degree Sparse Mesh Bootstrapping
        // Establish an O(1) connection limit to prevent N^2 global network collapse
        const MAX_DEGREE = 5;
        const availableIds = Array.from(clients.keys()).filter(id => id !== peerId && clients.get(id)!.readyState === WebSocket.OPEN);
        
        // Fisher-Yates Pseudo-Random Shuffle
        for (let i = availableIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableIds[i], availableIds[j]] = [availableIds[j], availableIds[i]];
        }
        
        const selectedPeers = availableIds.slice(0, MAX_DEGREE);
        for (const targetId of selectedPeers) {
            clients.get(targetId)!.send(JSON.stringify({ type: "PEER_JOINED", peerId }));
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
        for (const [_id, client] of clients.entries()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "PEER_LEFT", peerId }));
            }
        }
    };

    return response;
});

console.log(`[OMEGA-64] WebRTC Signaling Relay active on ws://localhost:${PORT}`);
