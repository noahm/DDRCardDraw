import { ReactChild, useEffect, useState } from "react";
import { RecoilSync } from "recoil-sync";

interface WebsocketSyncMessage {
  type: "recoilSyncUpdate";
  updates: Array<[key: string, value: unknown]>;
}

type MessageHandler = (ev: MessageEvent<string>) => void;

class PublishSocket {
  private socket: WebSocket | null = null;
  private ready = false;
  private handlerInWaiting: MessageHandler | null = null;

  public get isReady() {
    return this.ready;
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    this.socket = new WebSocket("ws://localhost:3000/ws?event=default");
    this.socket.addEventListener("open", () => {});
    if (this.handlerInWaiting) {
      this.socket.addEventListener("message", this.handlerInWaiting);
      this.handlerInWaiting = null;
    }
  }

  handleMessages(handler: MessageHandler) {
    const socket = this.socket;
    if (!socket) {
      this.handlerInWaiting = handler;
      return () => {
        if (this.socket) {
          this.socket.removeEventListener("message", handler);
        }
      };
    }
    socket.addEventListener("message", handler);
    return () => {
      console.log("removing event listener");
      socket.removeEventListener("message", handler);
    };
  }

  publish(message: WebsocketSyncMessage) {
    if (!this.socket) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  disconnect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }
}

export function RecoilWebsocketSync(props: { children: ReactChild }) {
  const [publishSocket] = useState(() => new PublishSocket());
  useEffect(() => {
    publishSocket.connect();
    return () => {
      publishSocket.disconnect();
    };
  }, []);

  return (
    <RecoilSync
      write={({ diff }) => {
        const message: WebsocketSyncMessage = {
          type: "recoilSyncUpdate",
          updates: [],
        };
        for (const [key, value] of diff) {
          message.updates.push([key, value]);
        }
        publishSocket.publish(message);
      }}
      listen={(api) =>
        publishSocket.handleMessages((event) => {
          console.log("event handler", event.data);
          const message: WebsocketSyncMessage = JSON.parse(event.data);
          if (message.type !== "recoilSyncUpdate") {
            return;
          }
          api.updateItems(new Map(message.updates));
        })
      }
    >
      {props.children}
    </RecoilSync>
  );
}
