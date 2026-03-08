import { useState } from "react";
import Layout from "./components/Layout.tsx";
import AIChat from "./pages/AIChat.tsx";
import Apps from "./pages/Apps.tsx";
import BackupManager from "./pages/BackupManager.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import EmailInbox from "./pages/EmailInbox.tsx";
import Files from "./pages/Files.tsx";
import Minecraft from "./pages/Minecraft.tsx";
import RouterDashboard from "./pages/RouterDashboard.tsx";
import Settings from "./pages/Settings.tsx";
import VPNManager from "./pages/VPNManager.tsx";

export type Page =
	| "dashboard"
	| "ai"
	| "apps"
	| "files"
	| "minecraft"
	| "vpn"
	| "backup"
	| "router"
	| "email"
	| "settings";

export default function App() {
	const [page, setPage] = useState<Page>("dashboard");

	const renderPage = () => {
		switch (page) {
			case "dashboard":
				return <Dashboard onNavigate={setPage} />;
			case "ai":
				return <AIChat />;
			case "apps":
				return <Apps />;
			case "files":
				return <Files />;
			case "minecraft":
				return <Minecraft />;
			case "vpn":
				return <VPNManager />;
			case "backup":
				return <BackupManager />;
			case "router":
				return <RouterDashboard />;
			case "email":
				return <EmailInbox />;
			case "settings":
				return <Settings />;
		}
	};

	return (
		<Layout page={page} onNavigate={setPage}>
			{renderPage()}
		</Layout>
	);
}
