import { redirect } from "next/navigation";

/** Ancienne route /users → Employés */
export default function UsersRedirectPage() {
  redirect("/employees");
}
