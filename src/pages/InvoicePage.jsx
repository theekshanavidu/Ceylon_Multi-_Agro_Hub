import { useState, useEffect, useCallback } from "react";
import {
    collection, getDocs, addDoc, query, orderBy,
    serverTimestamp, where, deleteDoc, doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { stampPDF } from "../utils/pdfStamp";
import {
    Plus, Download, FileText, Search, X,
    Loader2, DollarSign, Save, CheckCircle, AlertCircle,
} from "lucide-react";

/* ─────────── helpers ─────────── */
function todayDisplay() {
    return new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric",
    });
}
const emptyRow = () => ({ id: crypto.randomUUID(), name: "", qty: "", price: "" });
const calcSub = (r) => (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0);

/* ─────────── Component ─────────── */
export default function InvoicePage() {
    const [currency, setCurrency] = useState("LKR");
    const [issuedTo, setIssuedTo] = useState("Western Dynamic Shipping (PVT) Ltd - Kelaniya");
    const [rows, setRows] = useState([emptyRow()]);
    const [allItems, setAllItems] = useState([]);
    const [itemsLoaded, setItemsLoaded] = useState(false);
    const [suggestions, setSuggestions] = useState({});
    const [pdfBusy, setPdfBusy] = useState(false);
    const [saveBusy, setSaveBusy] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [invoiceNote, setInvoiceNote] = useState("");

    /* Load items */
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, "items"), orderBy("name")));
                setAllItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) { console.error("Items load:", e); }
            setItemsLoaded(true);
        })();
    }, []);

    const getPrice = useCallback(
        (item) => currency === "LKR" ? (item?.priceLKR || 0) : (item?.priceUSD || 0),
        [currency]
    );

    /* Autocomplete */
    const handleNameChange = (rowId, value) => {
        setRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            const matched = allItems.find(i => i.name.toLowerCase() === value.toLowerCase());
            return { ...r, name: value, price: matched ? getPrice(matched) : r.price };
        }));
        setSuggestions(prev => ({
            ...prev,
            [rowId]: value.trim().length > 0
                ? allItems.filter(i => i.name.toLowerCase().includes(value.toLowerCase()))
                : [],
        }));
    };

    const selectSuggestion = (rowId, item) => {
        setRows(prev => prev.map(r =>
            r.id === rowId ? { ...r, name: item.name, price: getPrice(item) } : r
        ));
        setSuggestions(prev => ({ ...prev, [rowId]: [] }));
    };

    /* Re-price on currency switch */
    useEffect(() => {
        setRows(prev => prev.map(r => {
            const m = allItems.find(i => i.name.toLowerCase() === r.name.toLowerCase());
            return m ? { ...r, price: getPrice(m) } : r;
        }));
    }, [currency, allItems, getPrice]);

    const updateRow = (id, f, v) => setRows(prev => prev.map(r => r.id === id ? { ...r, [f]: v } : r));
    const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
    const addRow = () => setRows(prev => [...prev, emptyRow()]);
    const grandTotal = rows.reduce((s, r) => s + calcSub(r), 0);

    /* Save Invoice */
    const handleSave = async () => {
        setSaveBusy(true);
        setSaveStatus(null);
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            const old = await getDocs(query(collection(db, "invoices"), where("createdAt", "<", cutoff)));
            await Promise.all(old.docs.map(d => deleteDoc(doc(db, "invoices", d.id))));
            await addDoc(collection(db, "invoices"), {
                issuedTo, date: todayDisplay(), currency,
                rows: rows.filter(r => r.name || r.qty || r.price),
                grandTotal, invoiceNote,
                createdAt: serverTimestamp(),
            });
            setSaveStatus("ok");
        } catch (e) { console.error("Save:", e); setSaveStatus("err"); }
        setSaveBusy(false);
        setTimeout(() => setSaveStatus(null), 3000);
    };

    /* Export PDF */
    const handleExportPDF = async () => {
        setPdfBusy(true);
        try {
            const bytes = await stampPDF({ issuedTo, currency, rows, grandTotal, invoiceNote });
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Invoice_${issuedTo.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("PDF:", e);
            alert("PDF generation failed:\n" + e.message);
        }
        setPdfBusy(false);
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-green-600" size={28} />
                        Create Invoice
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Ceylon Multi Agro Hub (Pvt) Ltd</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {/* Save */}
                    <button onClick={handleSave} disabled={saveBusy}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg disabled:opacity-60 text-white ${saveStatus === "ok" ? "bg-emerald-600" : saveStatus === "err" ? "bg-red-500" : "bg-blue-600 hover:bg-blue-700"
                            }`}>
                        {saveBusy ? <Loader2 size={18} className="animate-spin" />
                            : saveStatus === "ok" ? <CheckCircle size={18} />
                                : saveStatus === "err" ? <AlertCircle size={18} />
                                    : <Save size={18} />}
                        {saveBusy ? "Saving…" : saveStatus === "ok" ? "Saved!" : saveStatus === "err" ? "Failed!" : "Save Invoice"}
                    </button>
                    {/* Export PDF */}
                    <button onClick={handleExportPDF} disabled={pdfBusy}
                        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg hover:scale-[1.02] disabled:opacity-60">
                        {pdfBusy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        {pdfBusy ? "Generating…" : "Export as PDF"}
                    </button>
                </div>
            </div>

            {/* Warning */}
            {itemsLoaded && allItems.length === 0 && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    No items found. Add items in the <strong className="mx-1">Items</strong> tab first.
                </div>
            )}

            {/* Invoice Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

                {/* Letterhead */}
                <div className="bg-gradient-to-r from-green-800 to-emerald-700 px-6 md:px-10 py-6 text-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-xl md:text-2xl font-extrabold tracking-wide uppercase">Ceylon Multi Agro Hub (Pvt) Ltd</h2>
                            <p className="text-emerald-200 text-sm italic mt-0.5">"Rooted in Nature, Growing Ceylon"</p>
                            <p className="text-emerald-100 text-xs mt-1">No. 499/1B, Eldeniya, Kadawatha &nbsp;|&nbsp; ceylon.magro@gmail.com</p>
                            <p className="text-emerald-100 text-xs">+94 778 954 234 &nbsp;|&nbsp; +94 783 221 956 &nbsp;|&nbsp; +94 769 985 212</p>
                        </div>
                        <span className="text-4xl font-black tracking-widest text-white/90">INVOICE</span>
                    </div>
                </div>

                {/* Meta */}
                <div className="px-6 md:px-10 py-5 border-b border-slate-100 bg-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Issued Date</label>
                            <div className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 font-medium">{todayDisplay()}</div>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Issued To</label>
                            <input type="text" value={issuedTo} onChange={e => setIssuedTo(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-semibold" />
                        </div>
                    </div>
                </div>

                {/* Currency */}
                <div className="px-6 md:px-10 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                        <DollarSign size={16} className="text-green-600" /> Currency
                    </span>
                    <div className="flex gap-2">
                        {["LKR", "USD"].map(c => (
                            <button key={c} onClick={() => setCurrency(c)}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${currency === c ? "bg-green-700 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}>{c}</button>
                        ))}
                    </div>
                    <span className="text-xs text-slate-400">All prices auto-update on switch</span>
                </div>

                {/* Table */}
                <div className="px-6 md:px-10 py-6">
                    <div className="overflow-visible rounded-xl border border-slate-200">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead>
                                <tr className="bg-gradient-to-r from-green-700 to-emerald-600 text-white">
                                    <th className="text-center px-4 py-3 font-semibold rounded-tl-xl">DESCRIPTION</th>
                                    <th className="text-center px-4 py-3 font-semibold w-24">QTY/KG</th>
                                    <th className="text-center px-4 py-3 font-semibold w-36">PRICE/{currency}/KG</th>
                                    <th className="text-center px-4 py-3 font-semibold w-32">SUBTOTAL {currency}</th>
                                    <th className="w-10 rounded-tr-xl"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={row.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>

                                        {/* Description + autocomplete */}
                                        <td className="px-4 py-2">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={13} />
                                                <input type="text" value={row.name}
                                                    onChange={e => handleNameChange(row.id, e.target.value)}
                                                    onFocus={e => e.target.value.trim() && handleNameChange(row.id, e.target.value)}
                                                    onBlur={() => setTimeout(() => setSuggestions(p => ({ ...p, [row.id]: [] })), 300)}
                                                    placeholder="Search item name…"
                                                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white" />
                                                {suggestions[row.id]?.length > 0 && (
                                                    <div className="absolute top-[105%] left-0 z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden min-w-[250px]">
                                                        {suggestions[row.id].map(item => (
                                                            <button key={item.id} onMouseDown={(e) => { e.preventDefault(); selectSuggestion(row.id, item); }}
                                                                className="w-full text-left px-4 py-2.5 hover:bg-green-50 border-b border-slate-50 last:border-0 flex items-center justify-between cursor-pointer">
                                                                <span className="font-semibold text-slate-800 text-sm pointer-events-none">{item.name}</span>
                                                                <span className="text-xs text-slate-400 font-mono ml-2 pointer-events-none">
                                                                    {currency === "LKR" ? `LKR ${Number(item.priceLKR).toFixed(2)}` : `USD ${Number(item.priceUSD).toFixed(4)}`}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-2">
                                            <input type="number" min="0" step="0.01" value={row.qty}
                                                onChange={e => updateRow(row.id, "qty", e.target.value)} placeholder="0"
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white text-center" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" min="0" step="0.0001" value={row.price}
                                                onChange={e => updateRow(row.id, "price", e.target.value)} placeholder="0.00"
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white font-mono text-center" />
                                        </td>
                                        <td className="px-4 py-2 text-center font-semibold text-slate-700 font-mono">
                                            {calcSub(row).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            {rows.length > 1 && (
                                                <button onClick={() => removeRow(row.id)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button onClick={addRow}
                        className="mt-3 flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-semibold px-2 py-1 rounded-lg hover:bg-green-50 transition-colors">
                        <Plus size={16} /> Add Row
                    </button>

                    <div className="mt-6 flex justify-end">
                        <div className="bg-green-50 border border-green-200 rounded-xl px-8 py-4 text-right">
                            <p className="text-sm text-slate-500 mb-1">Grand Total</p>
                            <p className="text-2xl font-extrabold text-green-800">
                                {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} {currency}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 md:px-10 pt-4 pb-8 border-t border-slate-100 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                        <div>
                            <h3 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-3">Bank Account</h3>
                            <div className="space-y-1 text-sm text-slate-700">
                                {["273200140055470", "R. M. C. M Rathnayaka", "People's Bank", "Kadawatha Branch"].map(v => (
                                    <p key={v} className="font-medium">{v}</p>
                                ))}
                            </div>
                            <div className="mt-4">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Note (optional)</label>
                                <textarea rows={2} value={invoiceNote} onChange={e => setInvoiceNote(e.target.value)}
                                    placeholder="Add a note for the PDF…"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white resize-none" />
                            </div>
                        </div>
                        <div className="flex flex-col items-center md:items-end">
                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center bg-white min-w-[190px]">
                                <img src="/signature.png" alt="Signature" className="max-h-20 object-contain mb-2"
                                    onError={e => { e.target.style.display = "none"; }} />
                                <div className="w-full border-t border-slate-300 pt-2 text-center">
                                    <p className="text-xs font-bold text-slate-700">Managing Director</p>
                                    <p className="text-[10px] text-slate-400">Ceylon Multi Agro Hub (Pvt) Ltd</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
