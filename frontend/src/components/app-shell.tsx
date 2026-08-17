"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useMediaQuery, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import { useAuth } from "@/lib/auth";
import { assetUrl } from "@/lib/api";
import { confirmAction, toastSuccess } from "@/components/ui";

export const DRAWER_WIDTH = 264;

type NavItem = { label: string; icon: ReactNode; path: string };
type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", icon: <DashboardOutlinedIcon />, path: "/" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Sales & Orders", icon: <ReceiptLongOutlinedIcon />, path: "/sales" },
      { label: "Catalog", icon: <CategoryOutlinedIcon />, path: "/catalog" },
      { label: "Inventory", icon: <Inventory2OutlinedIcon />, path: "/inventory" },
      { label: "Purchasing", icon: <LocalShippingOutlinedIcon />, path: "/purchasing" },
      { label: "Manufacturing", icon: <PrecisionManufacturingOutlinedIcon />, path: "/manufacturing" },
    ],
  },
  {
    label: "Finance",
    items: [{ label: "Accounting", icon: <AccountBalanceOutlinedIcon />, path: "/finance" }],
  },
  {
    label: "Organization",
    items: [
      { label: "Human Resources", icon: <BadgeOutlinedIcon />, path: "/hr" },
      { label: "Profile", icon: <AccountCircleOutlinedIcon />, path: "/profile" },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", icon: <SettingsOutlinedIcon />, path: "/settings" }],
  },
];

export const ADMIN_NAV_GROUP: NavGroup = {
  label: "Admin",
  items: [
    { label: "Users", icon: <PeopleOutlineIcon />, path: "/users" },
    { label: "Roles", icon: <AdminPanelSettingsOutlinedIcon />, path: "/roles" },
  ],
};

export const PLATFORM_NAV_GROUPS: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { label: "Companies", icon: <BusinessOutlinedIcon />, path: "/companies" },
      { label: "Users", icon: <PeopleOutlineIcon />, path: "/platform/users" },
      { label: "Roles & Permissions", icon: <AdminPanelSettingsOutlinedIcon />, path: "/platform/roles" },
    ],
  },
];

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

export function AppShell({ children, topbar }: { children: ReactNode; topbar?: ReactNode }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState<null | HTMLElement>(null);

  const isSuperadmin = user?.kind === "superadmin";
  const canAdmin =
    user?.kind === "company" &&
    (user.permissions.includes("users:read") || user.permissions.includes("roles:read"));
  const navGroups = isSuperadmin
    ? PLATFORM_NAV_GROUPS
    : canAdmin
      ? NAV_GROUPS.flatMap((group) => (group.label === "System" ? [ADMIN_NAV_GROUP, group] : [group]))
      : NAV_GROUPS;

  const handleLogout = async () => {
    const ok = await confirmAction({
      title: "Sign out?",
      text: "You will need to sign in again to continue.",
      confirmText: "Sign out",
      cancelText: "Cancel",
      icon: "question",
    });
    if (!ok) return;
    await logout();
    toastSuccess("Signed out");
    router.replace("/login");
  };

  const sidebar = (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        height: "100%",
        bgcolor: "#0f172a",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, py: 2.5 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 18,
            color: "#fff",
          }}
        >
          E
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2, color: "#fff" }}>ERP Suite</Typography>
          <Typography sx={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Enterprise Management
          </Typography>
        </Box>
      </Stack>
      <Divider sx={{ borderColor: "rgba(148,163,184,0.15)" }} />
      <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1.5, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {navGroups.map((group) => (
          <Box key={group.label} sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                px: 1.5,
                py: 1,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#475569",
              }}
            >
              {group.label}
            </Typography>
            {group.items.map((item) => {
              const active = pathname === item.path;
              return (
                <ListItemButton
                  key={item.label}
                  selected={active}
                  onClick={() => {
                    router.push(item.path);
                    setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: 2,
                    mb: 0.25,
                    color: active ? "#fff" : "#94a3b8",
                    "&.Mui-selected": {
                      bgcolor: "rgba(79,70,229,0.22)",
                      color: "#fff",
                      "&:hover": { bgcolor: "rgba(79,70,229,0.3)" },
                    },
                    "&:hover": { bgcolor: "rgba(148,163,184,0.08)" },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 38, color: "inherit" }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} slotProps={{ primary: { fontSize: 13.5, fontWeight: active ? 600 : 500 } }} />
                  {active && <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#818cf8" }} />}
                </ListItemButton>
              );
            })}
          </Box>
        ))}
      </Box>
      <Divider sx={{ borderColor: "rgba(148,163,184,0.15)" }} />
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 2 }}>
        <Avatar
          src={user?.kind === "company" ? assetUrl(user.avatarUrl) : undefined}
          sx={{ width: 34, height: 34, bgcolor: "#4f46e5", fontSize: 14, fontWeight: 700 }}
        >
          {(user?.name ?? "U").slice(0, 2).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#fff" }} noWrap>{user?.name ?? "Loading…"}</Typography>
          <Typography sx={{ fontSize: 11.5, color: "#64748b" }} noWrap>{user?.email ?? ""}</Typography>
        </Box>
      </Stack>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 3,
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 20,
          }}
        >
          E
        </Box>
      </Box>
    );
  }

  if (!user) {
    router.replace("/login");
    return null;
  }

  if (isSuperadmin && !["/companies", "/platform/users", "/platform/roles"].includes(pathname)) {
    router.replace("/companies");
    return null;
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: isDesktop ? `calc(100% - ${DRAWER_WIDTH}px)` : "100%",
          ml: isDesktop ? `${DRAWER_WIDTH}px` : 0,
          bgcolor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #e2e8f0",
          color: "#0f172a",
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          {!isSuperadmin && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 2,
                bgcolor: "#f1f5f9",
                width: 320,
                maxWidth: "40vw",
              }}
            >
              <SearchIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
              <InputBase placeholder="Search orders, products, employees…" sx={{ fontSize: 13.5, flex: 1 }} />
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          {topbar}
          {!isSuperadmin && (
            <Tooltip title="Notifications">
              <IconButton>
                <Badge badgeContent={0} color="primary">
                  <NotificationsNoneIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Account">
            <IconButton
              onClick={(event) => setUserMenu(event.currentTarget)}
              sx={{ p: 0.25, ml: 0.5 }}
            >
              <Avatar
                src={user?.kind === "company" ? assetUrl(user.avatarUrl) : undefined}
                sx={{ width: 34, height: 34, bgcolor: "#4f46e5", fontSize: 13, fontWeight: 700 }}
              >
                {(user?.name ?? "U").slice(0, 2).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={userMenu}
            open={Boolean(userMenu)}
            onClose={() => setUserMenu(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem sx={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>Signed in as {user?.email}</MenuItem>
            <Divider />
            {!isSuperadmin && (
              <MenuItem sx={{ fontSize: 13.5, color: "#0f172a" }} onClick={() => router.push("/profile")}>
                <AccountCircleOutlinedIcon sx={{ fontSize: 18, mr: 1.25 }} /> Profile
              </MenuItem>
            )}
            <Divider />
            <MenuItem sx={{ fontSize: 13.5, color: "#dc2626" }} onClick={() => void handleLogout()}>
              <LogoutRoundedIcon sx={{ fontSize: 18, mr: 1.25 }} /> Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? "permanent" : "temporary"}
        open={isDesktop ? true : mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, borderRight: "none" },
        }}
      >
        {sidebar}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, px: { xs: 2, md: 4 }, pb: 6, pt: 11, maxWidth: 1440, mx: "auto", width: "100%" }}>
        <motion.div variants={listVariants} initial="hidden" animate="show">
          {children}
        </motion.div>
      </Box>
    </Box>
  );
}

export { listVariants, itemVariants };