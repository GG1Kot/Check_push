"use client";
import { useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushButton() {
  const [state, setState] = useState("Enable Push");
  const enable = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push is not supported in this browser");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted");
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured");
      let subscription = await registration.pushManager.getSubscription();
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription) });
      setState("Push Enabled");
    } catch (e) { setState(e instanceof Error ? e.message : "Push failed"); }
  };
  return <button className="button" onClick={enable}>{state}</button>;
}
