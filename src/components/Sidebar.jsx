import { FileText, PackageCheck, History, Menu, X, Leaf } from "lucide-react";
import { useState } from "react";

export default function Sidebar({ active, onNavigate }) {
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = [
        { id: "invoice", label: "Invoice", icon: FileText, color: "emerald" },
        { id: "items", label: "Items", icon: PackageCheck, color: "emerald" },
        { id: "old", label: "Old Invoices", icon: History, color: "indigo" },
    ];

    const NavContent = () => (
        <>
            {/* Logo */}
            <div className="px-5 py-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <Leaf size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm leading-tight">Ceylon Multi</p>
                        <p className="text-white font-bold text-sm leading-tight">Agro Hub</p>
                        <p className="text-emerald-300 text-[10px] italic">(Pvt) Ltd</p>
                    </div>
                </div>
            </div>

            {/* Slogan */}
            <div className="px-5 py-3 border-b border-white/10">
                <p className="text-emerald-300 text-[11px] italic text-center leading-snug">
                    "Rooted in Nature, Growing Ceylon"
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {/* Section label */}
                <p className="text-slate-500 text-[10px] uppercase tracking-widest px-4 mb-2 font-semibold">Menu</p>

                {navItems.map(({ id, label, icon: Icon, color }) => {
                    const isActive = active === id;
                    const activeCls = color === "indigo"
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                        : "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40";
                    return (
                        <button
                            key={id}
                            onClick={() => { onNavigate(id); setMobileOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${isActive ? activeCls : "text-slate-300 hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            <Icon size={18} />
                            {label}
                            {id === "old" && (
                                <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">30d</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10">
                <p className="text-slate-500 text-[10px] text-center">v1.1.0 — Invoice System</p>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="fixed top-4 left-4 z-50 md:hidden bg-green-800 text-white p-2 rounded-xl shadow-lg"
                onClick={() => setMobileOpen(o => !o)}
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed top-0 left-0 h-full z-40 flex flex-col
        w-60 bg-gradient-to-b from-[#1a1f2e] to-[#111622]
        shadow-2xl transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:flex
      `}>
                <NavContent />
            </aside>
        </>
    );
}
