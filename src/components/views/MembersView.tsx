import { type FormEvent, useMemo, useState } from "react";

import type {
  ApiDataResponse,
  MemberDto,
  MemberListItemDto,
  MembersListStatus,
  MembersListSort,
  PaginationOrder,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMembersList } from "@/components/hooks/useMembersList";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface FormErrors {
  displayName?: string;
}

const getFieldError = (error: ApiErrorViewModel | null, field: string) => {
  if (!error?.details || typeof error.details !== "object") return null;
  const details = error.details as { fieldErrors?: Record<string, string[]> };
  const fieldErrors = details.fieldErrors?.[field];
  if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) return null;
  return fieldErrors[0];
};

export const MembersView = () => {
  const { request } = useApiClient();
  const [status, setStatus] = useState<MembersListStatus>("active");
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingMember, setEditingMember] = useState<MemberListItemDto | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [formError, setFormError] = useState<ApiErrorViewModel | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [actionError, setActionError] = useState<ApiErrorViewModel | null>(null);

  const query = useMemo(
    () => ({
      status,
      sort: "createdAt" as MembersListSort,
      order: "desc" as PaginationOrder,
      limit: 50,
      offset: 0,
    }),
    [status]
  );

  const { items, total, loading, error, refetch } = useMembersList(query);

  const filteredItems = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return items;
    return items.filter((member) => (member.displayName ?? "").toLowerCase().includes(trimmed));
  }, [items, search]);

  const openAddForm = () => {
    setFormMode("add");
    setEditingMember(null);
    setDisplayName("");
    setFormError(null);
    setFieldErrors({});
  };

  const openEditForm = (member: MemberListItemDto) => {
    setFormMode("edit");
    setEditingMember(member);
    setDisplayName(member.displayName ?? "");
    setFormError(null);
    setFieldErrors({});
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingMember(null);
    setDisplayName("");
    setFormError(null);
    setFieldErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setActionError(null);

    const trimmed = displayName.trim();
    if (!trimmed) {
      setFieldErrors({ displayName: "Display name is required." });
      return;
    }

    if (formMode === "add") {
      const result = await request<ApiDataResponse<MemberDto>>("/api/members", {
        method: "POST",
        body: { displayName: trimmed },
      });

      if (result.error) {
        setFormError(result.error);
        setFieldErrors({ displayName: getFieldError(result.error, "displayName") ?? undefined });
        return;
      }

      closeForm();
      await refetch();
      return;
    }

    if (formMode === "edit" && editingMember) {
      const result = await request<ApiDataResponse<MemberDto>>(`/api/members/${editingMember.memberId}`, {
        method: "PATCH",
        body: { displayName: trimmed },
      });

      if (result.error) {
        setFormError(result.error);
        setFieldErrors({ displayName: getFieldError(result.error, "displayName") ?? undefined });
        return;
      }

      closeForm();
      await refetch();
    }
  };

  const handleRemove = async (member: MemberListItemDto) => {
    setActionError(null);
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Remove ${member.displayName ?? "this member"}?`);
      if (!confirmed) return;
    }

    const result = await request<null>(`/api/members/${member.memberId}`, {
      method: "DELETE",
    });

    if (result.error) {
      setActionError(result.error);
      return;
    }

    await refetch();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">Manage on-call members, initial counts, and saved assignments.</p>
      </header>

      <section className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4 shadow-sm">
        <div className="w-full max-w-xs space-y-1">
          <Label htmlFor="searchMembers">Search</Label>
          <Input
            id="searchMembers"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
          />
        </div>
        <div className="w-full max-w-xs space-y-1">
          <Label htmlFor="statusFilter">Status</Label>
          <Select
            id="statusFilter"
            value={status}
            onChange={(event) => setStatus(event.target.value as MembersListStatus)}
          >
            <option value="active">Active</option>
            <option value="all">All</option>
          </Select>
        </div>
        <div className="ml-auto">
          <Button onClick={openAddForm}>Add member</Button>
        </div>
      </section>

      {formMode ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            <h2 className="text-lg font-semibold">{formMode === "add" ? "Add member" : "Edit member"}</h2>
            <div className="space-y-1">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                name="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-invalid={Boolean(fieldErrors.displayName)}
              />
              {fieldErrors.displayName ? (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrors.displayName}
                </p>
              ) : null}
            </div>
            {formError ? (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {formError.message}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">{formMode === "add" ? "Create" : "Save changes"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {actionError ? (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {actionError.message}
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Members list</h2>
          <span className="text-sm text-muted-foreground">Total: {total}</span>
        </div>

        {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading members...</p> : null}
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error.message}
          </p>
        ) : null}

        {filteredItems.length === 0 && !loading ? (
          <p className="mt-4 text-sm text-muted-foreground">No members found.</p>
        ) : null}

        {filteredItems.length > 0 ? (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Name</TableHead>
                  <TableHead scope="col">Saved count</TableHead>
                  <TableHead scope="col">Initial count</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((member) => (
                  <TableRow key={member.memberId}>
                    <TableCell>{member.displayName}</TableCell>
                    <TableCell>{member.savedCount}</TableCell>
                    <TableCell>{member.initialOnCallCount}</TableCell>
                    <TableCell>
                      {member.deletedAt ? <span className="text-muted-foreground">Removed</span> : "Active"}
                    </TableCell>
                    <TableCell>
                      {member.deletedAt ? null : (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditForm(member)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleRemove(member)}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
    </div>
  );
};
