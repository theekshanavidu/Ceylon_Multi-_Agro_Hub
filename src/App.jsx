import { useState } from "react";
import Sidebar from "./components/Sidebar";
import InvoicePage from "./pages/InvoicePage";
import ItemsPage from "./pages/ItemsPage";
import OldInvoicesPage from "./pages/OldInvoicesPage";
import "./index.css";

export default function App() {
  const [page, setPage] = useState("invoice");
  const [editingInvoice, setEditingInvoice] = useState(null);

  const handleEditInvoice = (inv) => {
    setEditingInvoice(inv);
    setPage("invoice");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar active={page} onNavigate={setPage} />

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {page === "invoice" && (
          <InvoicePage 
            editingInvoice={editingInvoice} 
            onClearEdit={() => setEditingInvoice(null)} 
          />
        )}
        {page === "items" && <ItemsPage />}
        {page === "old" && (
          <OldInvoicesPage onEditInvoice={handleEditInvoice} />
        )}
      </main>
    </div>
  );
}
