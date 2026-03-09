import { useState, useEffect, useRef } from "react";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { Pencil, Trash2, Plus, Search, X, Loader2, PackageCheck } from "lucide-react";

export default function ItemsPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({ name: "", priceLKR: "", priceUSD: "" });
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "items"), orderBy("name"));
            const snap = await getDocs(q);
            setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchItems(); }, []);

    const openAdd = () => {
        setEditItem(null);
        setFormData({ name: "", priceLKR: "", priceUSD: "" });
        setShowForm(true);
    };

    const openEdit = (item) => {
        setEditItem(item);
        setFormData({ name: item.name, priceLKR: item.priceLKR, priceUSD: item.priceUSD });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.priceLKR || !formData.priceUSD) return;
        setSaving(true);
        try {
            const data = {
                name: formData.name.trim(),
                priceLKR: parseFloat(formData.priceLKR),
                priceUSD: parseFloat(formData.priceUSD),
            };
            if (editItem) {
                await updateDoc(doc(db, "items", editItem.id), data);
            } else {
                await addDoc(collection(db, "items"), data);
            }
            setShowForm(false);
            fetchItems();
        } catch (e) {
            console.error(e);
        }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, "items", id));
            setDeleteConfirm(null);
            fetchItems();
        } catch (e) {
            console.error(e);
        }
    };

    const filtered = items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <PackageCheck className="text-green-600" size={28} />
                        Items Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Manage your product catalogue with LKR & USD pricing</p>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg hover:shadow-green-200 hover:scale-[1.02]"
                >
                    <Plus size={18} /> Add Item
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Search items..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-400 text-slate-700 shadow-sm"
                />
                {search && (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-green-600">
                        <Loader2 size={32} className="animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <PackageCheck size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-lg font-medium">No items found</p>
                        <p className="text-sm">Add your first item to get started</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gradient-to-r from-green-700 to-emerald-600 text-white">
                                    <th className="text-left px-6 py-4 font-semibold">#</th>
                                    <th className="text-left px-6 py-4 font-semibold">Item Name</th>
                                    <th className="text-right px-6 py-4 font-semibold">Price (LKR)</th>
                                    <th className="text-right px-6 py-4 font-semibold">Price (USD)</th>
                                    <th className="text-center px-6 py-4 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        className={`border-b border-slate-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-green-50`}
                                    >
                                        <td className="px-6 py-4 text-slate-400 font-medium">{idx + 1}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-800">{item.name}</td>
                                        <td className="px-6 py-4 text-right text-slate-700 font-mono">
                                            {Number(item.priceLKR).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-700 font-mono">
                                            {Number(item.priceUSD).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openEdit(item)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(item.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Count */}
            {!loading && (
                <p className="text-xs text-slate-400 mt-3 text-right">
                    Showing {filtered.length} of {items.length} items
                </p>
            )}

            {/* Add/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
                        <button
                            onClick={() => setShowForm(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-slate-800 mb-6">
                            {editItem ? "Edit Item" : "Add New Item"}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Item Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Organic Cinnamon"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400 text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Price (LKR) per KG *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.priceLKR}
                                    onChange={(e) => setFormData({ ...formData, priceLKR: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400 text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Price (USD) per KG *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={formData.priceUSD}
                                    onChange={(e) => setFormData({ ...formData, priceUSD: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400 text-slate-800"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowForm(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.name || !formData.priceLKR || !formData.priceUSD}
                                className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                                {saving ? "Saving..." : editItem ? "Update" : "Add Item"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="text-red-500" size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Item?</h3>
                        <p className="text-slate-500 text-sm mb-6">This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
