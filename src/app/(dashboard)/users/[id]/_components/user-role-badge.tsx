import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types/database";

export function UserRoleBadge({ role }: { role: UserRole }) {
  switch (role) {
    case "admin":
      return <Badge variant="default">Admin</Badge>;
    case "employee":
      return <Badge variant="outline">Employé</Badge>;
    case "establishment":
      return <Badge variant="secondary">Établissement</Badge>;
    default:
      return <Badge variant="secondary">Client</Badge>;
  }
}
