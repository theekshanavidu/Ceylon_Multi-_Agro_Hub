import { useState, useEffect } from "react";
import {
    collection, getDocs, deleteDoc, doc,
    query, orderBy, where,
} from "firebase/firestore";
import { db } from "../firebase";
import { stampPDF } from "../utils/pdfStamp";
import {
    History, Trash2, Download, Loader2,
    FileText, Calendar, DollarSign, RefreshCw,
} from "lucide-react";



/* ─────────────── Component ─────────────── */
export default function OldInvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pdfBusy, setPdfBusy] = useState(null); // id of busy invoice
    const [delConfirm, setDelConfirm] = useState(null);

    const loadAndClean = async () => {
        setLoading(true);
        try {
            /* auto-delete invoices older than 30 days */
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            const oldSnap = await getDocs(
                query(collection(db, "invoices"), where("createdAt", "<", cutoff))
            );
            if (oldSnap.docs.length > 0) {
                await Promise.all(oldSnap.docs.map(d => deleteDoc(doc(db, "invoices", d.id))));
            }

            /* load remaining */
            const snap = await getDocs(
                query(collection(db, "invoices"), orderBy("createdAt", "desc"))
            );
            setInvoices(snap.docs.map(d => ({
                id: d.id, ...d.data(),
                createdAt: d.data().createdAt?.toDate?.() || new Date(),
            })));
        } catch (e) {
            console.error("Load invoices error:", e);
        }
        setLoading(false);
    };

    useEffect(() => { loadAndClean(); }, []);

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, "invoices", id));
            setDelConfirm(null);
            setInvoices(prev => prev.filter(i => i.id !== id));
        } catch (e) { console.error(e); }
    };

    const handleDownload = async (inv) => {
        setPdfBusy(inv.id);
        try {
            const pdfBytes = await stampPDF({
                issuedTo: inv.issuedTo,
                date: inv.date,
                currency: inv.currency,
                rows: inv.rows || [],
                grandTotal: inv.grandTotal || 0,
                invoiceNote: inv.invoiceNote || "",
            });
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Invoice_${(inv.issuedTo || "").replace(/[^a-zA-Z0-9]/g, "_")}_${inv.date?.replace(/\s/g, "_")}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) { alert("PDF error: " + e.message); }
        setPdfBusy(null);
    };

    /* days remaining until auto-delete */
    const daysLeft = (inv) => {
        const exp = new Date(inv.createdAt);
        exp.setDate(exp.getDate() + 30);
        return Math.max(0, Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24)));
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <History className="text-indigo-500" size={28} />
                        Old Invoices
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Saved invoices · auto-deleted after 30 days</p>
                </div>
                <button
                    onClick={loadAndClean}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-4 py-2 rounded-xl font-semibold transition-all hover:shadow-sm"
                >
                    <RefreshCw size={15} /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24 text-indigo-500">
                    <Loader2 size={36} className="animate-spin" />
                </div>
            ) : invoices.length === 0 ? (
                <div className="text-center py-24 text-slate-400">
                    <History size={56} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold">No saved invoices</p>
                    <p className="text-sm mt-1">Create and save an invoice from the Invoice tab</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {invoices.map(inv => {
                        const days = daysLeft(inv);
                        return (
                            <div
                                key={inv.id}
                                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                            >
                                {/* Card header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <FileText size={20} className="text-indigo-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{inv.issuedTo || "—"}</p>
                                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={11} /> {inv.date || "—"}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <DollarSign size={11} /> {inv.currency}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full font-semibold ${days <= 3 ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"}`}>
                                                    {days}d until auto-delete
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleDownload(inv)}
                                            disabled={pdfBusy === inv.id}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition-all disabled:opacity-60"
                                        >
                                            {pdfBusy === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                            PDF
                                        </button>
                                        <button
                                            onClick={() => setDelConfirm(inv.id)}
                                            className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Items summary */}
                                {inv.rows?.length > 0 && (
                                    <div className="px-6 py-3 overflow-x-auto">
                                        <table className="w-full text-xs min-w-[400px]">
                                            <thead>
                                                <tr className="text-slate-400 border-b border-slate-100">
                                                    <th className="text-left pb-2 font-semibold">Item</th>
                                                    <th className="text-center pb-2 font-semibold">QTY</th>
                                                    <th className="text-right pb-2 font-semibold">Price</th>
                                                    <th className="text-right pb-2 font-semibold">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {inv.rows.map((r, i) => (
                                                    <tr key={i} className="border-b border-slate-50 last:border-0">
                                                        <td className="py-1.5 text-slate-700 font-medium">{r.name}</td>
                                                        <td className="py-1.5 text-center text-slate-600">{r.qty} KG</td>
                                                        <td className="py-1.5 text-right font-mono text-slate-600">{Number(r.price).toFixed(2)}</td>
                                                        <td className="py-1.5 text-right font-mono font-semibold text-slate-800">
                                                            {((parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0)).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                                            <p className="text-sm font-extrabold text-green-700">
                                                {inv.currency} {Number(inv.grandTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Delete confirm modal */}
            {delConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="text-red-500" size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Invoice?</h3>
                        <p className="text-slate-500 text-sm mb-6">This cannot be undone.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDelConfirm(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold">Cancel</button>
                            <button onClick={() => handleDelete(delConfirm)} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
