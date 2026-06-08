"use client";
import Link from "next/link";

type Props = {
  productLogoSrc?: string;
  productName?: string;
  showHome?: boolean;
  /** When set, renders an extra breadcrumb link to the group's page. */
  groupHref?: string;
  groupName?: string;
};

/**
 * Brand-standard header: navy background, white Indecomm wordmark on the left,
 * optional product logo (e.g., AuditGenius) on the right as the differentiator.
 * Optionally renders a group breadcrumb link when the calling page belongs to a group.
 */
export function Header({
  productLogoSrc,
  productName,
  showHome = true,
  groupHref,
  groupName,
}: Props) {
  return (
    <header className="no-print bg-navy text-white">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex bg-white rounded-md px-3 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/indecomm.png"
              alt="Indecomm"
              className="h-6 w-auto"
            />
          </span>
          <span className="hidden sm:block text-sm tracking-wider uppercase opacity-80">
            ROI Calculator
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {productLogoSrc && (
            <div className="hidden md:flex items-center gap-2 bg-white/95 rounded-md px-3 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={productLogoSrc} alt={productName ?? "Product"} className="h-6 w-auto" />
            </div>
          )}
          {groupHref && groupName && (
            <Link href={groupHref} className="hidden sm:inline text-sm opacity-90 hover:opacity-100 underline">
              ← {groupName}
            </Link>
          )}
          {showHome && (
            <Link href="/" className="text-sm opacity-90 hover:opacity-100 underline">
              All Groups
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
