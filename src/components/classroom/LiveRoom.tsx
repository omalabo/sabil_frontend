import { useEffect, useState } from "react";
import { Room } from "livekit-client";

export default function LiveRoom({ roomName, token, serverUrl }) {
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    const r = new Room();

    const start = async () => {
      try {
        // 🔗 connexion
        console.log("🔑 Token reçu:", token?.substring(0, 20) + "...");
        console.log("🌐 Server URL:", serverUrl);
        const fixedServerUrl = serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        await r.connect(fixedServerUrl, token);

        setRoom(r);

        // 🎥 caméra + micro
        await r.localParticipant.enableCameraAndMicrophone();

        // 📺 recevoir vidéos
        r.on("trackSubscribed", (track) => {
          const element = track.attach();
          document.getElementById("video-container")?.appendChild(element);
        });

      } catch (err) {
        console.error("LiveKit error:", err);
      }
    };

    start();

    return () => {
      r.disconnect();
    };
  }, [serverUrl, token]);

  return (
    <div className="h-full w-full bg-black text-white">
      <div className="p-2 bg-gray-800 text-sm">
        🎥 Live Room - {roomName}
      </div>

      <div id="video-container" className="flex flex-wrap h-full"></div>
    </div>
  );
}