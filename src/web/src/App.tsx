import { useState } from "react";
import Layout from "./components/Layout.tsx";
import AIChat from "./pages/AIChat.tsx";
import Apps from "./pages/Apps.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Files from "./pages/Files.tsx";

export type Page = "dashboard" | "ai" | "apps" | "files";

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
		}
	};

	return (
		<Layout page={page} onNavigate={setPage}>
			{renderPage()}
		</Layout>
	);
}
