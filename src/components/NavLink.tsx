"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  className,
  activeClassName,
  title,
  exact = false,
  children,
}: {
  href: string;
  className: string;
  activeClassName: string;
  title?: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link href={href} title={title} className={`${className} ${isActive ? activeClassName : ""}`}>
      {children}
    </Link>
  );
}
