import {
  Calculator,
  Database,
  Image,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Key numbers and trends",
      },
      {
        href: "/reports",
        label: "Reports",
        icon: TrendingUp,
        description: "Deeper analytics and charts",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/sales",
        label: "Sales",
        icon: ShoppingBag,
        description: "Bills and custom orders",
      },
      {
        href: "/expenses",
        label: "Expenses",
        icon: Wallet,
        description: "Spending and suppliers",
      },
      {
        href: "/products",
        label: "Products",
        icon: Package,
        description: "Catalogue and pricing",
      },
    ],
  },
  {
    title: "Tools",
    items: [
      {
        href: "/public-apis",
        label: "Tools",
        icon: Image,
        description: "Stock photos & bg removal",
      },
      {
        href: "/calculations",
        label: "Calculator",
        icon: Calculator,
        description: "Price and cost maths",
      },
      {
        href: "/database",
        label: "Database",
        icon: Database,
        description: "Read-only collection browser",
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        description: "Shop profile and invoice",
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function titleForPath(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href));
}
