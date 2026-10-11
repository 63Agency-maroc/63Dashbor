import { redirect } from "next/navigation";

/** Plus de page Notifications dédiée — renvoie vers l’inbox WhatsApp. */
export default function NotificationsPage() {
  redirect("/whatsapp");
}
