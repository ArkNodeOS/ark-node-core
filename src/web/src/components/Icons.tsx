/**
 * Ark Node Icon Library — pure SVG, platform-identical.
 * Replaces all emoji usage so icons render the same on iOS, Android, Windows, Linux.
 *
 * Usage: <Icon name="anchor" className="w-5 h-5" />
 */
import { cloneElement } from "react";

export type IconName =
	| "anchor"
	| "eye"
	| "star4"
	| "diamond"
	| "gear"
	| "pickaxe"
	| "shield"
	| "archive"
	| "globe"
	| "envelope"
	| "cross"
	| "circle-dot"
	| "circle-ring"
	| "lock"
	| "phone"
	| "camera"
	| "cpu"
	| "wifi"
	| "server"
	| "fleuron";

interface IconProps {
	name: IconName;
	className?: string;
}

const PATHS: Record<IconName, React.ReactElement> = {
	anchor: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="5.5" r="2.5" />
			<line x1="12" y1="8" x2="12" y2="20" />
			<line x1="7" y1="12" x2="17" y2="12" />
			<path d="M7 20c0-2.5 2.2-4 5-4s5 1.5 5 4" />
		</svg>
	),
	eye: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	),
	star4: (
		<svg viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 2l2.09 7.91L22 12l-7.91 2.09L12 22l-2.09-7.91L2 12l7.91-2.09z" />
		</svg>
	),
	diamond: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 2L22 12 12 22 2 12z" />
			<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
		</svg>
	),
	gear: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="3" />
			<path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
		</svg>
	),
	pickaxe: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14.5 4L20 9.5 10 19.5 4.5 14z" />
			<line x1="4.5" y1="14" x2="2" y2="22" />
			<line x1="20" y1="4" x2="14.5" y2="4" />
		</svg>
	),
	shield: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7z" />
		</svg>
	),
	archive: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="2" y="3" width="20" height="5" rx="1" />
			<path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" />
			<path d="M10 13h4" />
		</svg>
	),
	globe: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
		</svg>
	),
	envelope: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="2" y="4" width="20" height="16" rx="2" />
			<path d="M2 7l10 7 10-7" />
		</svg>
	),
	cross: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		>
			<line x1="12" y1="2" x2="12" y2="22" />
			<line x1="4" y1="7" x2="20" y2="7" />
		</svg>
	),
	"circle-dot": (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
		</svg>
	),
	"circle-ring": (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="4" />
		</svg>
	),
	lock: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="5" y="11" width="14" height="10" rx="2" />
			<path d="M8 11V7a4 4 0 018 0v4" />
		</svg>
	),
	phone: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="5" y="2" width="14" height="20" rx="2" />
			<line x1="12" y1="18" x2="12" y2="18.5" strokeWidth="2" />
		</svg>
	),
	camera: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
			<circle cx="12" cy="13" r="4" />
		</svg>
	),
	cpu: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="4" y="4" width="16" height="16" rx="2" />
			<rect x="8" y="8" width="8" height="8" />
			<line x1="9" y1="4" x2="9" y2="2" />
			<line x1="15" y1="4" x2="15" y2="2" />
			<line x1="9" y1="22" x2="9" y2="20" />
			<line x1="15" y1="22" x2="15" y2="20" />
			<line x1="4" y1="9" x2="2" y2="9" />
			<line x1="4" y1="15" x2="2" y2="15" />
			<line x1="22" y1="9" x2="20" y2="9" />
			<line x1="22" y1="15" x2="20" y2="15" />
		</svg>
	),
	wifi: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M5 12.55a11 11 0 0114.08 0" />
			<path d="M1.42 9a16 16 0 0121.16 0" />
			<path d="M8.53 16.11a6 6 0 016.95 0" />
			<circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
		</svg>
	),
	server: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="2" y="3" width="20" height="7" rx="1" />
			<rect x="2" y="14" width="20" height="7" rx="1" />
			<circle cx="6" cy="6.5" r="1" fill="currentColor" stroke="none" />
			<circle cx="6" cy="17.5" r="1" fill="currentColor" stroke="none" />
		</svg>
	),
	fleuron: (
		<svg viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 4c0 3-2 5-4 6 2 1 4 3 4 6 0-3 2-5 4-6-2-1-4-3-4-6z" />
			<path d="M4 12c3 0 5 2 6 4 1-2 3-4 6-4-3 0-5-2-6-4-1 2-3 4-6 4z" />
		</svg>
	),
};

export function Icon({ name, className = "" }: IconProps) {
	// Cast to SVGProps so we can inject aria-hidden at runtime
	const svg = cloneElement(
		PATHS[name] as React.ReactElement<React.SVGProps<SVGSVGElement>>,
		{ "aria-hidden": true, focusable: false },
	);
	return (
		<span
			className={`inline-flex items-center justify-center shrink-0 ${className}`}
		>
			{svg}
		</span>
	);
}

/** Convenience: big decorative cross for background watermarks */
export function CrossWatermark({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 100 140"
			fill="none"
			stroke="currentColor"
			strokeWidth="6"
			strokeLinecap="round"
			className={className}
			aria-hidden="true"
		>
			<line x1="50" y1="5" x2="50" y2="135" />
			<line x1="10" y1="35" x2="90" y2="35" />
		</svg>
	);
}
