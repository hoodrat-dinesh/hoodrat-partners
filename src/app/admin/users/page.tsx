import type { Metadata } from "next";
import { UserStatusActions } from "@/components/actions";
import { Badge, DataTable, EmptyState, PageHeader, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getAdminUsers } from "@/lib/data";
import { formatDate, formatFollowers } from "@/lib/format";

export const metadata: Metadata = { title: "Influencers" };

function tone(status: string): "success" | "danger" | "warning" {
  if (status === "Active") return "success";
  if (status === "Suspended") return "danger";
  return "warning";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const query = filters.query?.trim().toLowerCase() || "";
  const status = filters.status?.toLowerCase() || "";
  const context = await requireAdmin();
  const records = await getAdminUsers(context);
  const baseUsers = records.map((user) => ({
    id: user.id,
    name: user.name,
    handle: user.handle ? `@${user.handle}` : "Not provided",
    followers: formatFollowers(user.followerCount),
    status: user.status === "approved" ? "Active" : `${user.status.charAt(0).toUpperCase()}${user.status.slice(1)}`,
    actionStatus: user.status,
    joined: formatDate(user.joinedAt),
  }));
  const users = baseUsers.filter((user) => {
    const matchesQuery = !query || `${user.name} ${user.handle}`.toLowerCase().includes(query);
    const matchesStatus =
      !status ||
      user.actionStatus === (status === "active" ? "approved" : status);
    return matchesQuery && matchesStatus;
  });
  return (
    <>
      <PageHeader
        eyebrow="Partner directory"
        title="Influencers"
        description="Review applications, control access, and keep partner status legible."
      />
      <form className="filter-bar" action="/admin/users" method="get">
        <label className="field">
          <span className="field__label">Search partners</span>
          <input className="input" name="query" type="search" placeholder="Name or Instagram handle" defaultValue={filters.query} />
        </label>
        <Select label="Status" name="status" defaultValue={filters.status || ""}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </Select>
        <button className="button button--secondary" type="submit">Apply filters</button>
      </form>
      {users.length ? (
        <DataTable caption="Influencer accounts" headers={["Partner", "Instagram", "Followers", "Joined", "Status", "Actions"]}>
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="Partner"><strong>{user.name}</strong></td>
              <td data-label="Instagram">{user.handle}</td>
              <td data-label="Followers">{user.followers}</td>
              <td data-label="Joined">{user.joined}</td>
              <td data-label="Status"><Badge tone={tone(user.status)}>{user.status}</Badge></td>
              <td data-label="Actions">
                <UserStatusActions userId={user.id} name={user.name} status={user.actionStatus} />
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <EmptyState title="No influencer accounts" body="Applications will appear here after partners complete onboarding." />
      )}
    </>
  );
}
