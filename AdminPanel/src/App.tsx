import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase.ts";

type UserStatus = "active" | "inactive" | "expired";
type UserRole = "admin" | "user";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  status: UserStatus;
  role: UserRole;
  startDate: string;
  endDate: string;
  createdAt: string;
  accessActive: boolean;
  subscriptionStatus: string;
  country: string;
};

type SupabaseUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  plan: string | null;
  role: string | null;
  access_active: boolean | null;
  subscription_status: string | null;
  created_at: string | null;
  current_period_end: string | null;
  country: string | null;
};

type PagoRow = {
  id: string;
  email: string | null;
  status: string | null;
  amount: number | null;
  created_at: string | null;
};

type PagoAdmin = {
  id: string;
  email: string;
  status: string;
  amount: number;
  createdAt: string;
};

const colors = {
  pageBg: "#f3f3f3",
  pageBg2: "#ebebeb",
  shell: "rgba(255,255,255,0.96)",
  shellBorder: "rgba(0,0,0,0.05)",
  shellShadow: "0 24px 60px rgba(0, 0, 0, 0.08)",
  sidebarTop: "#0d0d0d",
  sidebarBottom: "#000000",
  sidebarText: "#f5f5f5",
  panel: "rgba(255,255,255,0.92)",
  panelSolid: "#ffffff",
  panelBorder: "rgba(0,0,0,0.06)",
  text: "#111111",
  muted: "#8b8b8b",
  line: "#ececec",
  primary: "#111111",
  primaryDark: "#000000",
  primarySoft: "#f2f2f2",
  greenBg: "#eef8f1",
  greenText: "#2d9b5f",
  orangeBg: "#fff4e9",
  orangeText: "#d68b2c",
  redBg: "#fff0f1",
  redText: "#d85f6d",
  blueBg: "#eff4ff",
  blueText: "#5e84e8",
};

function toStartOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function toDateOnly(value?: string | null) {
  if (!value) return new Date().toISOString().split("T")[0];
  return value.slice(0, 10);
}

function getComputedStatus(user: AdminUser): UserStatus {
  if (user.role === "admin") return "active";

  const today = toStartOfDay(new Date());
  const end = toStartOfDay(parseLocalDate(user.endDate));

  if (!user.accessActive || user.subscriptionStatus === "inactive") return "inactive";
  if (end.getTime() < today.getTime()) return "expired";
  return "active";
}

function daysLeft(endDate: string, role?: UserRole) {
  if (role === "admin") return 9999;

  const today = toStartOfDay(new Date());
  const end = toStartOfDay(parseLocalDate(endDate));
  const diff = end.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(date: string) {
  const d = parseLocalDate(date);
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(status: UserStatus) {
  if (status === "active") return "Activo";
  if (status === "inactive") return "Inactivo";
  return "Vencido";
}

function statusColors(status: UserStatus) {
  if (status === "active") {
    return { bg: colors.greenBg, color: colors.greenText };
  }

  if (status === "inactive") {
    return { bg: colors.orangeBg, color: colors.orangeText };
  }

  return { bg: colors.redBg, color: colors.redText };
}

function mapSupabaseUser(row: SupabaseUserRow): AdminUser {
  const isAdmin = row.role === "admin";
  const safeStartDate = toDateOnly(row.created_at);
  const safeEndDate = isAdmin
    ? "2099-12-31"
    : toDateOnly(row.current_period_end || row.created_at);

  const user: AdminUser = {
    id: row.id,
    name: row.full_name?.trim() || "Sin nombre",
    email: row.email?.trim().toLowerCase() || "",
    phone: row.phone?.trim() || "",
    plan: isAdmin ? "Acceso ilimitado" : row.plan?.trim() || "Sin plan",
    role: isAdmin ? "admin" : "user",
    startDate: safeStartDate,
    endDate: safeEndDate,
    createdAt: row.created_at || new Date().toISOString(),
    accessActive: isAdmin ? true : Boolean(row.access_active),
    subscriptionStatus: isAdmin ? "active" : row.subscription_status || "inactive",
    status: "inactive",
    country: row.country || "Sin país",
  };

  return {
    ...user,
    status: getComputedStatus(user),
  };
}

function mapPagoRow(row: PagoRow): PagoAdmin {
  return {
    id: row.id,
    email: row.email?.trim().toLowerCase() || "",
    status: row.status || "failed",
    amount: Number(row.amount || 0),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function exportToCSV(users: AdminUser[]) {
  const headers = [
    "ID",
    "Nombre",
    "Correo",
    "Telefono",
    "Plan",
    "Estado",
    "Rol",
    "Fecha inicio",
    "Fecha vencimiento",
    "Dias restantes",
    "Fecha alta",
  ];

  const rows = users.map((user) => {
    const computedStatus = getComputedStatus(user);

    return [
      user.id,
      user.name,
      user.email,
      user.phone,
      user.plan,
      user.role === "admin" ? "ADMIN" : statusLabel(computedStatus),
      user.role,
      user.startDate,
      user.role === "admin" ? "Ilimitado" : user.endDate,
      user.role === "admin" ? "∞" : String(daysLeft(user.endDate, user.role)),
      user.createdAt,
    ];
  });

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "usuarios_admin.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pagos, setPagos] = useState<PagoAdmin[]>([]);
const [loadingPagos, setLoadingPagos] = useState(true);
const [pagosError, setPagosError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [rowEditForm, setRowEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    plan: "",
  });

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("usuarios")
        .select(

          "id, email, full_name, phone, plan, role, access_active, subscription_status, created_at, current_period_end, country"
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const mappedUsers = (data || []).map((row: SupabaseUserRow) =>
        mapSupabaseUser(row)
      );

      setUsers(mappedUsers);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setLoadError("No se pudieron cargar los usuarios.");
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
  loadUsers();
  loadPagos();
}, []);
async function loadPagos() {
  try {
    setLoadingPagos(true);
    setPagosError("");

    const { data, error } = await supabase
      .from("pagos")
      .select("id, email, status, amount, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const mappedPagos = (data || []).map((row: PagoRow) => mapPagoRow(row));
    setPagos(mappedPagos);
  } catch (error) {
    console.error("Error cargando pagos:", error);
    setPagosError("No se pudieron cargar los pagos.");
  } finally {
    setLoadingPagos(false);
  }
}

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const computedStatus = getComputedStatus(user);

      const matchesSearch =
        !term ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.phone.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ? true : computedStatus === statusFilter;

      const matchesRole =
        roleFilter === "all" ? true : user.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, search, statusFilter, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => getComputedStatus(u) === "active").length;
    const inactive = users.filter((u) => getComputedStatus(u) === "inactive").length;
    const expired = users.filter((u) => getComputedStatus(u) === "expired").length;
    const admins = users.filter((u) => u.role === "admin").length;

    const failedPayments = pagos.filter((p) => p.status === "failed").length;

return { total, active, inactive, expired, admins, failedPayments };
  }, [users, pagos]);

  useEffect(() => {
    if (!selectedUser) return;

    const freshUser = users.find((u) => u.id === selectedUser.id);
    if (!freshUser) return;

    setSelectedUser(freshUser);
  }, [users, selectedUser]);

  useEffect(() => {
    if (!selectedUser) return;

    setProfileForm({
      name: selectedUser.name,
      email: selectedUser.email,
      phone: selectedUser.phone,
    });
  }, [selectedUser]);

  function updateUserLocal(id: string, patch: Partial<AdminUser>) {
    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== id) return user;

        const nextUser = { ...user, ...patch };
        return {
          ...nextUser,
          status: getComputedStatus(nextUser as AdminUser),
        };
      })
    );

    setSelectedUser((prev) => {
      if (!prev || prev.id !== id) return prev;

      const nextUser = { ...prev, ...patch };
      return {
        ...nextUser,
        status: getComputedStatus(nextUser as AdminUser),
      };
    });
  }

  function startRowEdit(user: AdminUser) {
    setEditingUserId(user.id);
    setRowEditForm({
      name: user.name,
      phone: user.phone,
      email: user.email,
      plan: user.plan,
    });
  }

  function cancelRowEdit() {
    setEditingUserId(null);
    setRowEditForm({
      name: "",
      phone: "",
      email: "",
      plan: "",
    });
  }

  async function toggleUserStatus(user: AdminUser) {
    if (user.role === "admin") return;

    const computedStatus = getComputedStatus(user);

    try {
      if (computedStatus === "active") {
        const { error } = await supabase
          .from("usuarios")
          .update({
            access_active: false,
            subscription_status: "inactive",
          })
          .eq("id", user.id);

        if (error) throw error;

        updateUserLocal(user.id, {
          accessActive: false,
          subscriptionStatus: "inactive",
          status: "inactive",
        });
        return;
      }

      const end = parseLocalDate(user.endDate);
      const today = toStartOfDay(new Date());

      const nextSubscriptionStatus =
        end.getTime() < today.getTime() ? "inactive" : "active";

      const { error } = await supabase
        .from("usuarios")
        .update({
          access_active: true,
          subscription_status: nextSubscriptionStatus,
        })
        .eq("id", user.id);

      if (error) throw error;

      updateUserLocal(user.id, {
        accessActive: true,
        subscriptionStatus: nextSubscriptionStatus,
        status: end.getTime() < today.getTime() ? "expired" : "active",
      });
    } catch (error) {
      console.error("Error cambiando estado del usuario:", error);
      alert("No se pudo actualizar el estado del usuario.");
    }
  }

  async function saveRowEdit(user: AdminUser) {
    const nextName = rowEditForm.name.trim() || user.name;
    const nextPhone = rowEditForm.phone.trim() || user.phone;
    const nextEmail = rowEditForm.email.trim().toLowerCase() || user.email;
    const nextPlan = user.role === "admin"
      ? "Acceso ilimitado"
      : rowEditForm.plan.trim() || user.plan;

    try {
      const updatePayload =
        user.role === "admin"
          ? {
            full_name: nextName,
            phone: nextPhone,
            email: nextEmail,
          }
          : {
            full_name: nextName,
            phone: nextPhone,
            email: nextEmail,
            plan: nextPlan,
          };

      const { error } = await supabase
        .from("usuarios")
        .update(updatePayload)
        .eq("id", user.id);

      if (error) throw error;

      updateUserLocal(user.id, {
        name: nextName,
        phone: nextPhone,
        email: nextEmail,
        plan: nextPlan,
      });

      setEditingUserId(null);
    } catch (error) {
      console.error("Error guardando fila:", error);
      alert("No se pudieron guardar los cambios.");
    }
  }

  async function saveProfileChanges() {
    if (!selectedUser) return;

    const nextName = profileForm.name.trim() || selectedUser.name;
    const nextEmail = profileForm.email.trim().toLowerCase() || selectedUser.email;
    const nextPhone = profileForm.phone.trim() || selectedUser.phone;

    try {
      const { error } = await supabase
        .from("usuarios")
        .update({
          full_name: nextName,
          email: nextEmail,
          phone: nextPhone,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      updateUserLocal(selectedUser.id, {
        name: nextName,
        email: nextEmail,
        phone: nextPhone,
      });

      setIsEditingProfile(false);
    } catch (error) {
      console.error("Error guardando perfil:", error);
      alert("No se pudieron guardar los cambios del perfil.");
    }
  }

  function cancelProfileChanges() {
    if (!selectedUser) return;

    setProfileForm({
      name: selectedUser.name,
      email: selectedUser.email,
      phone: selectedUser.phone,
    });

    setIsEditingProfile(false);
  }
  return (
    <div style={pageStyle}>
      <div style={bgBubbleOneStyle} />
      <div style={bgBubbleTwoStyle} />

      <div style={shellStyle}>
        <aside style={sidebarStyle}>
          <div>
            <div style={sidebarMenuStyle}>
              <div
                style={{
                  ...sidebarItemStyle,
                  background: "rgba(255,255,255,0.18)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                }}
                title="Panel principal"
              >
                <span style={sidebarIconStyle}>⌂</span>
              </div>
            </div>
          </div>
        </aside>

        <main style={mainStyle}>
          <div style={topbarStyle}>
            <div>
              <div style={eyebrowStyle}>PANEL PRINCIPAL</div>
              <h1 style={titleStyle}>Control de suscriptores</h1>
            </div>

            <div style={topbarRightStyle}>
              <button
                onClick={() => exportToCSV(filteredUsers)}
                style={exportButtonStyle}
                title="Exportar usuarios filtrados"
              >
                Exportar CSV
              </button>

              <div style={appBrandCardStyle}>
                <div style={appBrandMiniStyle}>GYM</div>

                <div>
                  <div style={appBrandLabelStyle}>Nombre de la app</div>
                  <div style={appBrandTitleStyle}>APP GYM</div>
                  <div style={appBrandSubStyle}>
                    Panel de control de suscripciones activas
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={statsGridStyle}>
            <StatCard label="Usuarios" value={stats.total} />
            <StatCard label="Activos" value={stats.active} tone="green" />
            <StatCard label="Inactivos" value={stats.inactive} tone="orange" />
            <StatCard label="Vencidos" value={stats.expired} tone="red" />
            <StatCard label="Pagos rechazados" value={stats.failedPayments} tone="orange" />
          </div>

          <div style={dashboardGridStyle}>
            <section style={tablePanelStyle}>
              <div style={filtersRowStyle}>
                <div style={searchWrapStyle}>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, correo o teléfono"
                    style={searchInputStyle}
                  />
                  <span style={searchIconStyle}>⌕</span>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | UserStatus)
                  }
                  style={selectStyle}
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="expired">Vencidos</option>
                </select>

                <select
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(e.target.value as "all" | UserRole)
                  }
                  style={selectStyle}
                >
                  <option value="all">Todos los roles</option>
                  <option value="user">Users</option>
                  <option value="admin">Admins</option>
                </select>
              </div>

              {loadingUsers ? (
                <div style={emptyStateStyle}>Cargando usuarios...</div>
              ) : loadError ? (
                <div style={emptyStateStyle}>{loadError}</div>
              ) : (
                <div style={tableScrollerStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Cliente</th>
                        <th style={thStyle}>Teléfono</th>
                        <th style={thStyle}>Correo</th>
                        <th style={thStyle}>País</th>
                        <th style={thStyle}>Plan</th>
                        <th style={thStyle}>Estado</th>
                        <th style={thStyle}>Vence</th>
                        <th style={thStyle}>Días</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredUsers.map((user) => {
                        const computedStatus = getComputedStatus(user);
                        const badge = statusColors(computedStatus);
                        const left = daysLeft(user.endDate, user.role);
                        const isEditing = editingUserId === user.id;
                        const isAdmin = user.role === "admin";

                        return (
                          <tr
                            key={user.id}
                            style={trStyle}
                            onClick={() => setSelectedUser(user)}
                          >
                            <td style={tdStyle}>
                              <div style={nameCellStyle}>
                                <div style={leftControlsWrapStyle}>
                                  {isAdmin ? (
                                    <div style={adminBadgeStyle}>ADMIN</div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleUserStatus(user);
                                      }}
                                      style={{
                                        ...toggleButtonStyle,
                                        background:
                                          computedStatus === "active"
                                            ? "linear-gradient(180deg, #57b8ff 0%, #2563eb 100%)"
                                            : "linear-gradient(180deg, #8a8a8a 0%, #5f5f5f 100%)",
                                      }}
                                      title={
                                        computedStatus === "active"
                                          ? "Desactivar"
                                          : "Activar"
                                      }
                                    >
                                      <span
                                        style={{
                                          ...toggleLabelStyle,
                                          left: computedStatus === "active" ? 14 : 42,
                                        }}
                                      >
                                        {computedStatus === "active" ? "ON" : "OFF"}
                                      </span>

                                      <span
                                        style={{
                                          ...toggleKnobStyle,
                                          transform:
                                            computedStatus === "active"
                                              ? "translateX(52px)"
                                              : "translateX(0px)",
                                        }}
                                      />
                                    </button>
                                  )}

                                  <div style={actionsInlineStyle}>
                                    {isEditing ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            saveRowEdit(user);
                                          }}
                                          style={saveButtonStyle}
                                          title="Guardar"
                                        >
                                          ✓
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            cancelRowEdit();
                                          }}
                                          style={cancelButtonStyle}
                                          title="Cancelar"
                                        >
                                          ✕
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startRowEdit(user);
                                        }}
                                        style={iconButtonStyle}
                                        title="Editar nombre, teléfono, correo y plan"
                                      >
                                        ✎
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div style={nameContentStyle}>
                                  {isEditing ? (
                                    <input
                                      value={rowEditForm.name}
                                      onChange={(e) =>
                                        setRowEditForm((prev) => ({
                                          ...prev,
                                          name: e.target.value,
                                        }))
                                      }
                                      style={tableInputStyle}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <div style={dataBoxStyle}>{user.name}</div>
                                  )}

                                  <div style={subTextStyle}>
                                    {isAdmin ? "Administrador" : "Usuario"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={tdStyle}>
                              {isEditing ? (
                                <input
                                  value={rowEditForm.phone}
                                  onChange={(e) =>
                                    setRowEditForm((prev) => ({
                                      ...prev,
                                      phone: e.target.value,
                                    }))
                                  }
                                  style={tableInputStyle}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div style={dataBoxStyle}>{user.phone || "—"}</div>
                              )}
                            </td>

                            <td style={tdStyle}>
                              {isEditing ? (
                                <input
                                  value={rowEditForm.email}
                                  onChange={(e) =>
                                    setRowEditForm((prev) => ({
                                      ...prev,
                                      email: e.target.value,
                                    }))
                                  }
                                  style={tableInputStyle}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div style={dataBoxStyle}>{user.email}</div>
                              )}
                            </td>
                            <td style={tdStyle}>
                              <div style={dataBoxStyle}>{user.country || "—"}</div>
                            </td>
                            <td style={tdStyle}>
                              {isEditing ? (
                                <input
                                  value={rowEditForm.plan}
                                  onChange={(e) =>
                                    setRowEditForm((prev) => ({
                                      ...prev,
                                      plan: e.target.value,
                                    }))
                                  }
                                  style={tableInputStyle}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={isAdmin}
                                />
                              ) : (
                                <div style={dataBoxStyle}>{user.plan}</div>
                              )}
                            </td>

                            <td style={tdStyle}>
                              {isAdmin ? (
                                <span
                                  style={{
                                    ...statusBadgeStyle,
                                    background: colors.blueBg,
                                    color: colors.blueText,
                                  }}
                                >
                                  ADMIN
                                </span>
                              ) : (
                                <span
                                  style={{
                                    ...statusBadgeStyle,
                                    background: badge.bg,
                                    color: badge.color,
                                  }}
                                >
                                  {statusLabel(computedStatus)}
                                </span>
                              )}
                            </td>

                            <td style={tdStyle}>
                              {isAdmin ? (
                                <>
                                  <div style={nameTextStyleSmall}>Acceso ilimitado</div>
                                  <div style={subTextStyle}>Administrador interno</div>
                                </>
                              ) : (
                                <>
                                  <div style={nameTextStyleSmall}>
                                    {formatDate(user.endDate)}
                                  </div>
                                  <div style={subTextStyle}>
                                    {formatDate(user.startDate)}
                                  </div>
                                </>
                              )}
                            </td>

                            <td style={tdStyle}>
                              {isAdmin ? (
                                <span
                                  style={{
                                    ...daysPillStyle,
                                    background: colors.blueBg,
                                    color: colors.blueText,
                                  }}
                                >
                                  ∞
                                </span>
                              ) : (
                                <span
                                  style={{
                                    ...daysPillStyle,
                                    background: left < 0 ? colors.redBg : colors.blueBg,
                                    color: left < 0 ? colors.redText : colors.blueText,
                                  }}
                                >
                                  {left}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredUsers.length === 0 && (
                    <div style={emptyStateStyle}>
                      No se encontraron usuarios con esos filtros.
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside style={detailPanelStyle}>
              {!selectedUser ? (
                <div style={emptyDetailStyle}>
                  Selecciona un usuario para ver su detalle.
                </div>
              ) : (
                (() => {
                  const computedStatus = getComputedStatus(selectedUser);
                  const selectedDaysLeft = daysLeft(
                    selectedUser.endDate,
                    selectedUser.role
                  );
                  const isAdmin = selectedUser.role === "admin";

                  return (
                    <>
                      <div style={detailHeaderStyle}>
                        {isAdmin ? (
                          <div style={adminBadgeStyle}>ADMIN</div>
                        ) : (
                          <button
                            onClick={() => toggleUserStatus(selectedUser)}
                            style={{
                              ...toggleButtonStyle,
                              background:
                                computedStatus === "active"
                                  ? "linear-gradient(180deg, #57b8ff 0%, #2563eb 100%)"
                                  : "linear-gradient(180deg, #8a8a8a 0%, #5f5f5f 100%)",
                            }}
                            title={
                              computedStatus === "active" ? "Desactivar" : "Activar"
                            }
                          >
                            <span
                              style={{
                                ...toggleLabelStyle,
                                left: computedStatus === "active" ? 14 : 42,
                              }}
                            >
                              {computedStatus === "active" ? "ON" : "OFF"}
                            </span>

                            <span
                              style={{
                                ...toggleKnobStyle,
                                transform:
                                  computedStatus === "active"
                                    ? "translateX(52px)"
                                    : "translateX(0px)",
                              }}
                            />
                          </button>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={detailNameStyle}>{selectedUser.name}</div>
                          <div style={detailEmailStyle}>{selectedUser.email}</div>
                        </div>

                        <button
                          onClick={() => setIsEditingProfile((prev) => !prev)}
                          style={editProfileButtonStyle}
                          title="Editar nombre, correo y teléfono"
                        >
                          ✎
                        </button>
                      </div>

                      {isEditingProfile ? (
                        <div style={editCardStyle}>
                          <div style={editFieldWrapStyle}>
                            <label style={editLabelStyle}>Nombre</label>
                            <input
                              value={profileForm.name}
                              onChange={(e) =>
                                setProfileForm((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              style={editInputStyle}
                            />
                          </div>

                          <div style={editFieldWrapStyle}>
                            <label style={editLabelStyle}>Correo</label>
                            <input
                              value={profileForm.email}
                              onChange={(e) =>
                                setProfileForm((prev) => ({
                                  ...prev,
                                  email: e.target.value,
                                }))
                              }
                              style={editInputStyle}
                            />
                          </div>

                          <div style={editFieldWrapStyle}>
                            <label style={editLabelStyle}>Número</label>
                            <input
                              value={profileForm.phone}
                              onChange={(e) =>
                                setProfileForm((prev) => ({
                                  ...prev,
                                  phone: e.target.value,
                                }))
                              }
                              style={editInputStyle}
                            />
                          </div>

                          <div style={editActionsRowStyle}>
                            <button
                              onClick={saveProfileChanges}
                              style={primaryActionStyle}
                            >
                              Guardar cambios
                            </button>

                            <button
                              onClick={cancelProfileChanges}
                              style={secondaryActionStyle}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={detailInfoCardStyle}>
                          <DetailRow label="Teléfono" value={selectedUser.phone || "—"} />
                          <DetailRow label="Plan" value={selectedUser.plan} />
                          <DetailRow
                            label="Rol"
                            value={isAdmin ? "Administrador" : "Usuario"}
                          />
                          <DetailRow
                            label="Estado"
                            value={
                              isAdmin ? "Acceso ilimitado" : statusLabel(computedStatus)
                            }
                          />
                          <DetailRow
                            label="Inicio"
                            value={formatDate(selectedUser.startDate)}
                          />
                          {isAdmin ? (
                            <DetailRow
                              label="Tipo"
                              value="Interno"
                              noBorder
                            />
                          ) : (
                            <>
                              <DetailRow
                                label="Vencimiento"
                                value={formatDate(selectedUser.endDate)}
                              />
                              <DetailRow
                                label="Días restantes"
                                value={String(selectedDaysLeft)}
                                noBorder
                              />
                            </>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()
              )}
              <div style={{ marginTop: 18 }}>
  <div
    style={{
      fontSize: 14,
      fontWeight: 800,
      color: "#111111",
      marginBottom: 10,
    }}
  >
    Pagos rechazados
  </div>

  {loadingPagos ? (
    <div style={emptyStateStyle}>Cargando pagos...</div>
  ) : pagosError ? (
    <div style={emptyStateStyle}>{pagosError}</div>
  ) : pagos.length === 0 ? (
    <div style={emptyStateStyle}>No hay pagos rechazados.</div>
  ) : (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxHeight: 260,
        overflowY: "auto",
      }}
    >
      {pagos.filter((pago) => pago.status === "failed").map((pago) => (
        <div
          key={pago.id}
          style={{
            background: "#fff",
            border: "1px solid #ececec",
            borderRadius: 14,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 700, color: "#111111", marginBottom: 4 }}>
            {pago.email || "Sin correo"}
          </div>
          <div style={{ fontSize: 12, color: "#8b8b8b", marginBottom: 4 }}>
            Estado: {pago.status}
          </div>
          <div style={{ fontSize: 12, color: "#8b8b8b", marginBottom: 4 }}>
            Monto: {pago.amount}
          </div>
          <div style={{ fontSize: 12, color: "#8b8b8b" }}>
            Fecha: {new Date(pago.createdAt).toLocaleString("es-MX")}
          </div>
        </div>
      ))}
    </div>
  )}
</div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "orange" | "red" | "blue";
}) {
  let valueColor = colors.text;
  let cardBg = colors.panelSolid;

  if (tone === "green") {
    valueColor = colors.greenText;
    cardBg = "#f8fffb";
  } else if (tone === "orange") {
    valueColor = colors.orangeText;
    cardBg = "#fffaf5";
  } else if (tone === "red") {
    valueColor = colors.redText;
    cardBg = "#fff9fa";
  } else if (tone === "blue") {
    valueColor = colors.blueText;
    cardBg = "#f7faff";
  }

  return (
    <div style={{ ...statCardStyle, background: cardBg }}>
      <div style={statLabelStyle}>{label}</div>
      <div style={{ ...statValueStyle, color: valueColor }}>{value}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  noBorder = false,
}: {
  label: string;
  value: string;
  noBorder?: boolean;
}) {
  return (
    <div
      style={{
        ...detailRowStyle,
        borderBottom: noBorder ? "none" : `1px solid ${colors.line}`,
      }}
    >
      <div style={detailRowLabelStyle}>{label}</div>
      <div style={detailRowValueStyle}>{value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(135deg, ${colors.pageBg} 0%, ${colors.pageBg2} 100%)`,
  padding: 28,
  fontFamily: "Inter, Arial, sans-serif",
  position: "relative",
  overflowX: "hidden",
  boxSizing: "border-box",
};

const bgBubbleOneStyle: React.CSSProperties = {
  position: "absolute",
  width: 340,
  height: 340,
  borderRadius: "50%",
  right: -110,
  bottom: -90,
  background:
    "radial-gradient(circle, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.015) 72%, transparent 100%)",
  pointerEvents: "none",
};

const bgBubbleTwoStyle: React.CSSProperties = {
  position: "absolute",
  width: 220,
  height: 220,
  borderRadius: "50%",
  left: "28%",
  top: 60,
  background:
    "radial-gradient(circle, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.01) 74%, transparent 100%)",
  pointerEvents: "none",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1420,
  margin: "0 auto",
  background: colors.shell,
  border: `1px solid ${colors.shellBorder}`,
  borderRadius: 30,
  boxShadow: colors.shellShadow,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  display: "grid",
  gridTemplateColumns: "88px minmax(0, 1fr)",
  overflow: "hidden",
  position: "relative",
  zIndex: 2,
};

const sidebarStyle: React.CSSProperties = {
  background: `linear-gradient(180deg, ${colors.sidebarTop} 0%, ${colors.sidebarBottom} 100%)`,
  padding: "20px 12px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  minHeight: "calc(100vh - 56px)",
};

const sidebarMenuStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const sidebarItemStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 16,
  color: colors.sidebarText,
  fontSize: 18,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  margin: "0 auto",
};

const sidebarIconStyle: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
};

const mainStyle: React.CSSProperties = {
  padding: 22,
  minWidth: 0,
};

const topbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
  flexWrap: "wrap",
};

const topbarRightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const exportButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 18,
  padding: "0 18px",
  minHeight: 56,
  background: "linear-gradient(180deg, #2cc56f 0%, #169c52 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(22,156,82,0.22)",
};

const eyebrowStyle: React.CSSProperties = {
  color: colors.muted,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.1,
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: colors.text,
  fontSize: 34,
  lineHeight: 1.05,
  fontWeight: 900,
};

const appBrandCardStyle: React.CSSProperties = {
  minWidth: 320,
  maxWidth: "100%",
  background: "#ffffff",
  border: "1px solid #ececec",
  borderRadius: 24,
  padding: "18px 20px",
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow: "0 12px 28px rgba(0,0,0,0.06)",
  boxSizing: "border-box",
};

const appBrandMiniStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 18,
  background: "#111111",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 15,
  flexShrink: 0,
};

const appBrandLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8b8b8b",
  fontWeight: 700,
  marginBottom: 4,
};

const appBrandTitleStyle: React.CSSProperties = {
  fontSize: 24,
  color: "#111111",
  fontWeight: 900,
  lineHeight: 1,
  marginBottom: 4,
};

const appBrandSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#7d7d7d",
  fontWeight: 500,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const statCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: `1px solid ${colors.panelBorder}`,
  padding: "10px 16px",
  boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  minWidth: 0,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: colors.muted,
  fontWeight: 700,
  marginBottom: 6,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
};

const dashboardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.7fr) minmax(300px, 0.9fr)",
  gap: 18,
  alignItems: "start",
};

const tablePanelStyle: React.CSSProperties = {
  background: colors.panel,
  border: `1px solid ${colors.shellBorder}`,
  borderRadius: 24,
  padding: 16,
  boxShadow: "0 10px 26px rgba(0,0,0,0.05)",
  minWidth: 0,
};

const filtersRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.6fr) minmax(160px, 0.8fr) minmax(160px, 0.8fr)",
  gap: 12,
  marginBottom: 14,
};

const searchWrapStyle: React.CSSProperties = {
  position: "relative",
  minWidth: 0,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: `1px solid ${colors.line}`,
  background: "#fff",
  padding: "14px 42px 14px 16px",
  color: colors.text,
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: colors.muted,
  fontSize: 14,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: `1px solid ${colors.line}`,
  background: "#fff",
  padding: "14px 14px",
  color: colors.text,
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
  minWidth: 0,
};

const tableScrollerStyle: React.CSSProperties = {
  overflowX: "auto",
  overflowY: "hidden",
  width: "100%",
  paddingBottom: 6,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 12px",
  minWidth: 920,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  color: colors.muted,
  fontSize: 12,
  fontWeight: 800,
  padding: "0 12px 8px",
  whiteSpace: "nowrap",
};

const trStyle: React.CSSProperties = {
  background: colors.panelSolid,
  boxShadow: "0 8px 18px rgba(0, 0, 0, 0.04)",
  cursor: "pointer",
};

const tdStyle: React.CSSProperties = {
  color: colors.text,
  fontSize: 14,
  padding: "16px 12px",
  verticalAlign: "middle",
  borderTop: `1px solid ${colors.line}`,
  borderBottom: `1px solid ${colors.line}`,
};

const nameCellStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  minWidth: 280,
};

const nameContentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 160,
};

const leftControlsWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  flexShrink: 0,
};

const actionsInlineStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 34,
};

const nameTextStyleSmall: React.CSSProperties = {
  color: colors.text,
  fontWeight: 700,
  fontSize: 13,
  marginBottom: 3,
};

const subTextStyle: React.CSSProperties = {
  color: colors.muted,
  fontSize: 12,
  marginTop: 6,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "7px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const daysPillStyle: React.CSSProperties = {
  display: "inline-flex",
  minWidth: 34,
  justifyContent: "center",
  alignItems: "center",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const adminBadgeStyle: React.CSSProperties = {
  minWidth: 92,
  height: 40,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(180deg, #111111 0%, #000000 100%)",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 0.5,
  boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
};

const iconButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: `1px solid ${colors.line}`,
  background: "#fff",
  color: colors.primaryDark,
  cursor: "pointer",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dataBoxStyle: React.CSSProperties = {
  background: "#f7f7f7",
  border: "1px solid #e9e9e9",
  borderRadius: 12,
  padding: "10px 12px",
  minHeight: 40,
  display: "flex",
  alignItems: "center",
  fontWeight: 600,
  color: "#111111",
  width: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const tableInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  borderRadius: 12,
  border: "1px solid #dcdcdc",
  background: "#ffffff",
  padding: "10px 12px",
  color: "#111111",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const saveButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid #d9eadf",
  background: "#eef8f1",
  color: "#2d9b5f",
  cursor: "pointer",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cancelButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid #f0d8dc",
  background: "#fff0f1",
  color: "#d85f6d",
  cursor: "pointer",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const toggleButtonStyle: React.CSSProperties = {
  width: 92,
  height: 40,
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.14)",
  cursor: "pointer",
  position: "relative",
  overflow: "hidden",
  padding: 0,
  boxSizing: "border-box",
  boxShadow:
    "inset 0 2px 6px rgba(255,255,255,0.18), 0 6px 14px rgba(0,0,0,0.18)",
  transition: "background 0.28s ease, box-shadow 0.28s ease",
  flexShrink: 0,
};

const toggleLabelStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: 0.4,
  lineHeight: 1,
  color: "#ffffff",
  transition: "left 0.28s ease, opacity 0.28s ease",
  userSelect: "none",
  pointerEvents: "none",
};

const toggleKnobStyle: React.CSSProperties = {
  position: "absolute",
  top: 4,
  left: 5,
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "linear-gradient(180deg, #5e6673 0%, #2c313a 100%)",
  boxShadow:
    "0 4px 10px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.18)",
  transition: "transform 0.28s ease",
  pointerEvents: "none",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "18px 8px 4px",
  color: colors.muted,
};

const detailPanelStyle: React.CSSProperties = {
  background: colors.panel,
  border: `1px solid ${colors.shellBorder}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 10px 26px rgba(0,0,0,0.05)",
  minWidth: 0,
};

const emptyDetailStyle: React.CSSProperties = {
  minHeight: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: colors.muted,
  textAlign: "center",
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginBottom: 16,
};

const detailNameStyle: React.CSSProperties = {
  color: colors.text,
  fontWeight: 800,
  fontSize: 22,
  lineHeight: 1.05,
  marginBottom: 5,
};

const detailEmailStyle: React.CSSProperties = {
  color: colors.muted,
  fontSize: 13,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const editProfileButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid #e9e9e9",
  background: "#ffffff",
  color: "#111111",
  cursor: "pointer",
  fontWeight: 800,
  flexShrink: 0,
};

const detailInfoCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  border: `1px solid ${colors.line}`,
  padding: 14,
  marginBottom: 16,
};

const detailRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "11px 0",
};

const detailRowLabelStyle: React.CSSProperties = {
  color: colors.muted,
  fontWeight: 700,
};

const detailRowValueStyle: React.CSSProperties = {
  color: colors.text,
  fontWeight: 700,
  textAlign: "right",
};

const editCardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #ececec",
  padding: 14,
  marginBottom: 16,
};

const editFieldWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 12,
};

const editLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6f6f6f",
};

const editInputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid #e7e7e7",
  background: "#fafafa",
  padding: "12px 14px",
  color: "#111111",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const editActionsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 6,
};

const primaryActionStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "13px 12px",
  background: `linear-gradient(180deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryActionStyle: React.CSSProperties = {
  border: `1px solid ${colors.line}`,
  borderRadius: 14,
  padding: "13px 12px",
  background: "#fff",
  color: colors.text,
  fontWeight: 700,
  cursor: "pointer",
};