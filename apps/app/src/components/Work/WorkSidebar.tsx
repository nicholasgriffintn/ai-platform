import {
	ChevronRight,
	Activity,
	Database,
	FolderKanban,
	Grid2X2,
	LayoutDashboard,
	ClipboardList,
	MessageSquareText,
	PanelsTopLeft,
	Settings2,
	SquarePen,
	Users,
} from "lucide-react";
import { Link, NavLink, useLocation, useSearchParams } from "react-router";

import { SidebarFooter } from "~/components/Sidebar/SidebarFooter";
import { SidebarHeader } from "~/components/Sidebar/SidebarHeader";
import { SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { useWorkData } from "./WorkContext";

interface WorkSidebarProps {
	workspaceId?: string;
	projectId?: string;
}

export function WorkSidebar({ workspaceId, projectId }: WorkSidebarProps) {
	const { sidebarVisible, setSidebarVisible, isMobile } = useUIStore();
	const { workspacesQuery, workspaceQuery, projectQuery } = useWorkData();
	const { data } = workspacesQuery;
	const { data: workspace } = workspaceQuery;
	const { data: project } = projectQuery;
	const { pathname } = useLocation();
	const [searchParams] = useSearchParams();
	const { clearCurrentConversation, currentConversationId, setCurrentConversationId } =
		useChatStore();
	const routedConversationId = searchParams.get("completion_id") ?? undefined;
	const activeConversationId =
		routedConversationId ??
		project?.conversations.find((conversation) => conversation.id === currentConversationId)?.id;
	const projectChatPath = `/work/${workspaceId ?? ""}/projects/${projectId ?? ""}/chat`;
	const isProjectChatRoute = pathname === projectChatPath;

	const closeOnMobile = () => {
		if (isMobile) setSidebarVisible(false);
	};

	const linkClass = ({ isActive }: { isActive: boolean }) =>
		cn(
			"flex items-center gap-2 rounded-lg p-2 text-sm no-underline transition-colors",
			isActive
				? "bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
				: "text-zinc-600 hover:bg-zinc-200 hover:text-black dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
		);

	return (
		<SidebarShell
			visible={sidebarVisible}
			isMobile={isMobile}
			onClose={() => setSidebarVisible(false)}
			header={<SidebarHeader />}
			footer={<SidebarFooter />}
		>
			<nav className="space-y-5 p-2 pb-8">
				<div className="space-y-1">
					<NavLink to="/work" end className={linkClass} onClick={closeOnMobile}>
						<LayoutDashboard size={17} /> Workspaces
					</NavLink>
				</div>

				{workspace && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 px-2">
							<p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
								{workspace.name}
							</p>
						</div>
						<NavLink to={`/work/${workspace.id}`} end className={linkClass} onClick={closeOnMobile}>
							<FolderKanban size={16} /> Projects
						</NavLink>
						<NavLink
							to={`/work/${workspace.id}/members`}
							className={linkClass}
							onClick={closeOnMobile}
						>
							<Users size={16} /> People
						</NavLink>
						{(workspace.role === "owner" || workspace.role === "admin") && (
							<NavLink
								to={`/work/${workspace.id}/governance`}
								className={linkClass}
								onClick={closeOnMobile}
							>
								<ClipboardList size={16} /> Governance
							</NavLink>
						)}
					</div>
				)}

				{workspace && workspace.projects.length > 0 && (
					<div>
						<p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
							Projects
						</p>
						<ul className="space-y-1">
							{workspace.projects.map((project) => (
								<li key={project.id}>
									<NavLink
										to={`/work/${workspace.id}/projects/${project.id}`}
										className={({ isActive }) =>
											cn(linkClass({ isActive: isActive || project.id === projectId }), "group")
										}
										onClick={closeOnMobile}
									>
										<span
											className="h-2.5 w-2.5 rounded-full"
											style={{ backgroundColor: project.colour }}
										/>
										<span className="min-w-0 flex-1 truncate">{project.name}</span>
										<ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />
									</NavLink>
								</li>
							))}
						</ul>
					</div>
				)}

				{projectId && workspaceId && (
					<div className="space-y-1">
						<Link
							to={projectChatPath}
							aria-current={isProjectChatRoute && !activeConversationId ? "page" : undefined}
							className={linkClass({ isActive: isProjectChatRoute && !activeConversationId })}
							onClick={() => {
								clearCurrentConversation();
								closeOnMobile();
							}}
						>
							<SquarePen size={16} /> New conversation
						</Link>
						<NavLink
							to={`/work/${workspaceId}/projects/${projectId}/experiences`}
							className={linkClass}
							onClick={closeOnMobile}
						>
							<Grid2X2 size={16} /> Experiences
						</NavLink>
						<NavLink
							to={`/work/${workspaceId}/projects/${projectId}/outputs`}
							className={linkClass}
							onClick={closeOnMobile}
						>
							<PanelsTopLeft size={16} /> Outputs
						</NavLink>
						<NavLink
							to={`/work/${workspaceId}/projects/${projectId}/sources`}
							className={linkClass}
							onClick={closeOnMobile}
						>
							<Database size={16} /> Sources
						</NavLink>
						<NavLink
							to={`/work/${workspaceId}/projects/${projectId}/activity`}
							className={linkClass}
							onClick={closeOnMobile}
						>
							<Activity size={16} /> Activity
						</NavLink>
						<NavLink
							to={`/work/${workspaceId}/projects/${projectId}/library`}
							className={linkClass}
							onClick={closeOnMobile}
						>
							<Settings2 size={16} /> Capabilities
						</NavLink>
						{project?.conversations.length ? (
							<div className="pt-4">
								<p className="px-2 pb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
									Recent conversations
								</p>
								<ul className="space-y-1">
									{project.conversations.map((conversation) => (
										<li key={conversation.id}>
											<Link
												to={`/work/${workspaceId}/projects/${projectId}/chat?completion_id=${encodeURIComponent(conversation.id)}`}
												aria-current={
													isProjectChatRoute && activeConversationId === conversation.id
														? "page"
														: undefined
												}
												className={linkClass({
													isActive: isProjectChatRoute && activeConversationId === conversation.id,
												})}
												onClick={() => {
													setCurrentConversationId(conversation.id);
													closeOnMobile();
												}}
											>
												<MessageSquareText size={16} className="shrink-0" />
												<span className="truncate">
													{conversation.title || "New project conversation"}
												</span>
											</Link>
										</li>
									))}
								</ul>
							</div>
						) : null}
					</div>
				)}

				{!workspaceId && data?.workspaces.length ? (
					<div>
						<p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
							Your workspaces
						</p>
						<ul className="space-y-1">
							{data.workspaces.map((item) => (
								<li key={item.id}>
									<NavLink to={`/work/${item.id}`} className={linkClass} onClick={closeOnMobile}>
										<FolderKanban size={16} />
										<span className="truncate">{item.name}</span>
									</NavLink>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</nav>
		</SidebarShell>
	);
}
