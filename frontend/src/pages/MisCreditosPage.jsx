function money(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

const activeCredits = [
  {
    id: 1,
    name: "Crédito de Consumo",
    pending: 2450000,
    nextInstallment: 185400,
    dueDate: "2026-05-10",
  },
];

const history = [
  {
    id: 1,
    product: "Crédito de Consumo",
    amount: 3500000,
    status: "Aprobada",
  },
  {
    id: 2,
    product: "Crédito de Consumo",
    amount: 5000000,
    status: "Rechazada",
  },
];

export default function MisCreditosPage() {
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Créditos activos</h2>

        <div className="grid md:grid-cols-2 gap-4">
          {activeCredits.map((credit) => (
            <div key={credit.id} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">{credit.name}</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p><strong>Saldo pendiente:</strong> {money(credit.pending)}</p>
                <p><strong>Próxima cuota:</strong> {money(credit.nextInstallment)}</p>
                <p><strong>Fecha de vencimiento:</strong> {credit.dueDate}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Historial de solicitudes</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-3">Producto</th>
                <th className="py-3">Monto</th>
                <th className="py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-4">{item.product}</td>
                  <td className="py-4">{money(item.amount)}</td>
                  <td className="py-4">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}