import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, CheckCircle, AlertCircle, Plus, Download, Upload, FileSpreadsheet, Trash2, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const AccountsPayableSystem = () => {
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({
    period: 'month',
    status: 'all',
    category: 'all',
    search: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState('dashboard');
 const [formData, setFormData] = useState({
  description: '',
  group: '',
  account: '',
  personSupplier: '',
  dueDate: '',
  amount: '',
  paymentMethod: '',
  bank: '',
  obs: '',
  expenseType: 'fixa',
  recurring: 'nao'
});



  const categories = {
    'PESSOAL': ['Vale Transporte', 'Salários e encargos', 'Bolsa Auxílio', 'Pro Labore', 'PLR'],
    'IMPOSTOS': ['FGTS', 'INSS', 'DAS', 'IRRF', 'IPVA', 'Taxas'],
    'ESTRUTURA': ['Aluguel', 'Água', 'Luz', 'Telefone', 'Seguro', 'Condomínio'],
    'CARTÕES': ['Despesas com Cartão'],
    'FORNECEDORES': ['Material Didático', 'Uniforme', 'Sistema', 'Manutenção', 'Marketing']
  };

  useEffect(() => {
    loadData();
  }, []);

  const STORAGE_KEY = 'accounts-payable-data';

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setAccounts(JSON.parse(raw));
  } catch (error) {
    console.log('Nenhum dado salvo ainda');
  }
};

const saveData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Erro ao salvar:', error);
  }
};


  const resetForm = () => {
  setFormData({
    description: '',
    group: '',
    account: '',
    personSupplier: '',
    dueDate: '',
    amount: '',
    paymentMethod: '',
    bank: '',
    obs: '',
    expenseType: 'fixa',
    recurring: 'nao'
  });
};


  const handleSubmit = () => {
    if (!formData.description || !formData.group || !formData.dueDate || !formData.amount) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

   const newAccount = {
  ...formData,
  id: Date.now(),
  amount: parseFloat(formData.amount),
  createdAt: new Date().toISOString(),
  paymentDate: ''
};


    const newAccounts = [...accounts, newAccount];
    setAccounts(newAccounts);
    saveData(newAccounts);
    setShowForm(false);
    resetForm();
  };

  const deleteAccount = (id) => {
    if (confirm('Confirma a exclusão desta conta?')) {
      const newAccounts = accounts.filter(acc => acc.id !== id);
      setAccounts(newAccounts);
      saveData(newAccounts);
    }
  };

 const markAsPaid = (id, paymentDate, bank) => {
  const newAccounts = accounts.map(acc =>
    acc.id === id ? { ...acc, paymentDate, bank } : acc
  );
  setAccounts(newAccounts);
  saveData(newAccounts);
};


  const exportData = () => {
    const dataStr = JSON.stringify(accounts, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contas-a-pagar-backup-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (Array.isArray(importedData)) {
          setAccounts(importedData);
          saveData(importedData);
          alert('✅ ' + importedData.length + ' contas importadas com sucesso!');
        } else {
          alert('Formato de arquivo inválido');
        }
      } catch (error) {
        alert('Erro ao importar arquivo. Verifique se é um arquivo válido.');
        console.error(error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const importFromSpreadsheet = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const importedAccounts = [];
        let importCount = 0;

        jsonData.forEach((row, index) => {
          try {
            const grupo = row['Grupo'] || row['GRUPO'] || '';
            const descricao = row['DESCRIÇÃO'] || row['Descrição'] || row['DESCRICAO'] || '';
            const diaVenc = row['DIA VENC.'] || row['DIA VENC'] || row['Dia Venc'] || '';
            const valor = row['VALOR'] || row['Valor'] || 0;
            const pagto = row['PAGTO'] || row['Pagto'] || '';
            const banco = row['Banco'] || row['BANCO'] || '';
            const obs = row['OBS'] || row['Obs'] || '';
            const conta = row['CTA'] || row['Cta'] || '';

            if (!descricao || descricao.trim() === '') return;

            let dueDate = '';
            if (diaVenc) {
              const today = new Date();
              const year = today.getFullYear();
              const month = today.getMonth() + 1;
              const day = parseInt(diaVenc);
              
              if (day && day >= 1 && day <= 31) {
                dueDate = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
              }
            }

            let amount = 0;
            if (valor) {
              amount = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            }

            let status = 'pending';
            if (pagto && pagto !== '') {
              status = 'paid';
            }

            let category = 'FORNECEDORES';
            if (grupo.includes('PESSOAL') || descricao.includes('Salário') || descricao.includes('Vale')) {
              category = 'PESSOAL';
            } else if (grupo.includes('IMPOSTOS') || descricao.includes('INSS') || descricao.includes('FGTS') || descricao.includes('DAS')) {
              category = 'IMPOSTOS';
            } else if (grupo.includes('ESTRUTURA') || descricao.includes('Aluguel') || descricao.includes('Água') || descricao.includes('Luz')) {
              category = 'ESTRUTURA';
            } else if (grupo.includes('CARTÕES') || descricao.includes('Master') || descricao.includes('Visa')) {
              category = 'CARTÕES';
            }

            if (amount > 0 && dueDate) {
              importedAccounts.push({
                id: Date.now() + index,
                description: descricao,
                group: category,
                account: String(conta),
                supplier: grupo !== category ? grupo : '',
                dueDate: dueDate,
                amount: amount,
                bank: banco,
                obs: obs,
                status: status,
                paymentDate: pagto || ''
              });
              importCount++;
            }
          } catch (err) {
            console.error('Erro na linha', index, err);
          }
        });

        if (importedAccounts.length > 0) {
          const confirmMsg = 'Encontradas ' + importedAccounts.length + ' contas válidas.\n\nDeseja SUBSTITUIR ou ADICIONAR?\n\nOK = SUBSTITUIR todos os dados\nCancelar = ADICIONAR às contas existentes';
          
          if (confirm(confirmMsg)) {
            setAccounts(importedAccounts);
            saveData(importedAccounts);
          } else {
            const allAccounts = [...accounts, ...importedAccounts];
            setAccounts(allAccounts);
            saveData(allAccounts);
          }
          
          alert('✅ ' + importCount + ' contas importadas com sucesso!');
        } else {
          alert('❌ Nenhuma conta válida encontrada no arquivo.');
        }

      } catch (error) {
        alert('Erro ao importar planilha: ' + error.message);
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const getFilteredAccounts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return accounts.filter(acc => {
      const dueDate = new Date(acc.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      if (filters.period === 'today' && dueDate.getTime() !== today.getTime()) return false;
      if (filters.period === 'week') {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (dueDate < today || dueDate > weekEnd) return false;
      }
      if (filters.period === 'month') {
        if (dueDate.getMonth() !== today.getMonth() || 
            dueDate.getFullYear() !== today.getFullYear()) return false;
      }
      
      if (filters.status !== 'all') {
        const status = getAccountStatus(acc);
        if (status !== filters.status) return false;
      }
      
      if (filters.category !== 'all' && acc.group !== filters.category) return false;
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return acc.description.toLowerCase().includes(search) ||
               (acc.supplier && acc.supplier.toLowerCase().includes(search));
      }
      
      return true;
    });
  };

  const getAccountStatus = (account) => {
  // Pago: tem data de pagamento
  if (account.paymentDate && String(account.paymentDate).trim() !== '') {
    return 'paid';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(account.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today ? 'overdue' : 'pending';
};


  const calculateTotals = () => {
    const filtered = getFilteredAccounts();
    const totals = {
      projected: 0,
      paid: 0,
      pending: 0,
      overdue: 0
    };

    filtered.forEach(acc => {
      totals.projected += acc.amount;
      const status = getAccountStatus(acc);
      if (status === 'paid') totals.paid += acc.amount;
      else if (status === 'overdue') totals.overdue += acc.amount;
      else totals.pending += acc.amount;
    });

    return totals;
  };

  const getByCategory = () => {
    const byCategory = {};
    accounts.forEach(acc => {
      if (!byCategory[acc.group]) {
        byCategory[acc.group] = { projected: 0, paid: 0, pending: 0 };
      }
      byCategory[acc.group].projected += acc.amount;
      if (acc.status === 'paid') {
        byCategory[acc.group].paid += acc.amount;
      } else {
        byCategory[acc.group].pending += acc.amount;
      }
    });
    return byCategory;
  };

  const totals = calculateTotals();
  const byCategory = getByCategory();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-t-4 border-blue-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <img 
                src="https://i.imgur.com/placeholder.png" 
                alt="Colégio Querubin's" 
                className="h-16 w-16 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full" style={{display: 'none'}}>
                <span className="text-2xl font-bold text-white">CQ</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Colégio Querubin's</h1>
                <p className="text-sm text-gray-600">Sistema de Contas a Pagar</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportData}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm shadow-md transition"
              >
                <Download size={18} />
                Exportar Backup
              </button>
              <label className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 cursor-pointer text-sm shadow-md transition">
                <FileSpreadsheet size={18} />
                Importar Excel
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={importFromSpreadsheet}
                  className="hidden"
                />
              </label>
              <label className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 cursor-pointer text-sm shadow-md transition">
                <Upload size={18} />
                Restaurar Backup
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 text-sm shadow-md transition"
              >
                <Plus size={18} />
                Nova Conta
              </button>
            </div>
          </div>

          <div className="flex gap-4 border-b border-blue-100">
            <button
              onClick={() => setView('dashboard')}
              className={'pb-3 px-4 font-medium transition ' + (view === 'dashboard' ? 'border-b-3 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-blue-500')}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setView('list')}
              className={'pb-3 px-4 font-medium transition ' + (view === 'list' ? 'border-b-3 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-blue-500')}
            >
              📋 Lista de Contas
            </button>
            <button
              onClick={() => setView('reports')}
              className={'pb-3 px-4 font-medium transition ' + (view === 'reports' ? 'border-b-3 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-blue-500')}
            >
              📈 Relatórios
            </button>
          </div>
        </div>

        {view === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-100 font-medium">Projetado</span>
                  <TrendingUp size={28} />
                </div>
                <div className="text-3xl font-bold">
                  R$ {totals.projected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-100 font-medium">Pago</span>
                  <CheckCircle size={28} />
                </div>
                <div className="text-3xl font-bold">
                  R$ {totals.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-100 font-medium">A Pagar</span>
                  <Calendar size={28} />
                </div>
                <div className="text-3xl font-bold">
                  R$ {totals.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-100 font-medium">Vencido</span>
                  <AlertCircle size={28} />
                </div>
                <div className="text-3xl font-bold">
                  R$ {totals.overdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                  <select
                    value={filters.period}
                    onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                    className="border rounded-lg px-4 py-2"
                  >
                    <option value="today">Hoje</option>
                    <option value="week">Esta Semana</option>
                    <option value="month">Este Mês</option>
                    <option value="all">Todos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="border rounded-lg px-4 py-2"
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="border rounded-lg px-4 py-2"
                  >
                    <option value="all">Todas</option>
                    {Object.keys(categories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
                  <input
                    type="text"
                    placeholder="Buscar por descrição ou fornecedor..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="border rounded-lg px-4 py-2 w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Próximos Vencimentos</h2>
              <div className="space-y-2">
                {getFilteredAccounts()
                  .filter(acc => getAccountStatus(acc) !== 'paid')
                  .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                  .slice(0, 10)
                  .map(acc => {
                    const status = getAccountStatus(acc);
                    return (
                      <div key={acc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{acc.description}</div>
                          <div className="text-sm text-gray-600">{acc.supplier || acc.group}</div>
                        </div>
                        <div className="text-right mr-4">
                          <div className="font-bold text-gray-900">
                            R$ {acc.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(acc.dueDate).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div>
                          {status === 'overdue' && (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                              Vencido
                            </span>
                          )}
                          {status === 'pending' && (
                            <button
                              onClick={() => {
                                const date = prompt('Data do pagamento (AAAA-MM-DD):');
                                const bank = prompt('Banco:');
                                if (date && bank) {
                                  markAsPaid(acc.id, date, bank);
                                }
                              }}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 font-medium"
                            >
                              Marcar como Pago
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {getFilteredAccounts().filter(acc => getAccountStatus(acc) !== 'paid').length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    Nenhuma conta pendente
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {view === 'list' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Todas as Contas ({accounts.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Vencimento</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Descrição</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Categoria</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Fornecedor</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Valor</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {getFilteredAccounts().map(acc => {
                    const status = getAccountStatus(acc);
                    return (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(acc.dueDate).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{acc.description}</td>
                        <td className="px-4 py-3 text-sm">{acc.group}</td>
                        <td className="px-4 py-3 text-sm">{acc.supplier || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          R$ {acc.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (
                            status === 'paid' ? 'bg-green-100 text-green-700' :
                            status === 'overdue' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          )}>
                            {status === 'paid' ? 'Pago' : status === 'overdue' ? 'Vencido' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-2 justify-center">
                            {status !== 'paid' && (
                              <button
                                onClick={() => {
                                  const date = prompt('Data do pagamento (AAAA-MM-DD):');
                                  const bank = prompt('Banco:');
                                  if (date && bank) {
                                    markAsPaid(acc.id, date, bank);
                                  }
                                }}
                                className="text-green-600 hover:text-green-700"
                                title="Marcar como pago"
                              >
                                <CheckCircle size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => deleteAccount(acc.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'reports' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Relatório por Centro de Custo</h2>
            <div className="space-y-4">
              {Object.entries(byCategory).map(([category, data]) => (
                <div key={category} className="border rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3">{category}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Projetado</div>
                      <div className="text-lg font-bold">
                        R$ {data.projected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Pago</div>
                      <div className="text-lg font-bold text-green-600">
                        R$ {data.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">A Pagar</div>
                      <div className="text-lg font-bold text-yellow-600">
                        R$ {data.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: (data.paid / data.projected * 100) + '%' }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {(data.paid / data.projected * 100).toFixed(1)}% realizado
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Nova Conta a Pagar</h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição *
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: Aluguel do escritório"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  >
                    <option value="">Selecione...</option>
                    {Object.keys(categories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conta
                  </label>
                  <input
                    type="text"
                    value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Código da conta"
                  />
                </div>
               <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Pessoa / Fornecedor
  </label>
  <input
    type="text"
    value={formData.personSupplier}
    onChange={(e) => setFormData({ ...formData, personSupplier: e.target.value })}
    className="w-full border rounded-lg px-4 py-2"
    placeholder="Ex: Fernanda, Fornecedor X, Aluguel"
  />
</div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vencimento *
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="0.00"
                  />
                </div>
		<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Tipo de despesa
  </label>
  <select
    value={formData.expenseType}
    onChange={(e) => setFormData({ ...formData, expenseType: e.target.value })}
    className="w-full border rounded-lg px-4 py-2"
  >
    <option value="fixa">Fixa</option>
    <option value="variavel">Variável</option>
  </select>
</div>

<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Recorrente
  </label>
  <select
    value={formData.recurring}
    onChange={(e) => setFormData({ ...formData, recurring: e.target.value })}
    className="w-full border rounded-lg px-4 py-2"
  >
    <option value="nao">Não</option>
    <option value="sim">Sim</option>
  </select>
</div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banco
                  </label>
                  <input
                    type="text"
                    value={formData.bank}
                    onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: Itaú, Inter"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
		<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Forma de pagamento
  </label>
  <select
    value={formData.paymentMethod}
    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
    className="w-full border rounded-lg px-4 py-2"
  >
    <option value="">Selecione...</option>
    <option value="PIX">PIX</option>
    <option value="Boleto">Boleto</option>
    <option value="Transferência">Transferência</option>
    <option value="Cartão">Cartão</option>
    <option value="Dinheiro">Dinheiro</option>
  </select>
</div>

<div className="col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Observações
  </label>
  <textarea
    value={formData.obs}
    onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
    rows="3"
    className="w-full border rounded-lg px-4 py-2"
    placeholder="Informações adicionais..."
  ></textarea>
</div>
                    Observações
                  </label>
                  <textarea
                    value={formData.obs}
                    onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
                    rows="3"
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Informações adicionais..."
                  ></textarea>
                </div>
              </div>
              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 font-medium shadow-md"
                >
                  ✓ Adicionar Conta
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-8 text-center text-gray-500 text-sm pb-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="font-medium text-blue-600">© 2024 Colégio Querubin's</p>
            <p className="text-xs mt-1">Sistema de Gestão Financeira - Todos os direitos reservados</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AccountsPayableSystem