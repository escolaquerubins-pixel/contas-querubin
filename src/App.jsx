import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Plus,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  X,
  Pencil,
  LogOut,
  Lock,
  Settings,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import logoQuerubins from "./assets/logo-querubins.png";
import { supabase } from "./supabaseClient";

/**
 * =========================
 * DADOS DA EMPRESA
 * =========================
 */
const COMPANY_NAME = "Querubin's Núcleo Educacional Ltda-me";
const COMPANY_CNPJ = "CNPJ: 05.210.023/0001/44";

/**
 * =========================
 * LOGIN (SUPABASE AUTH)
 * =========================
 */

/**
 * =========================
 * STORAGE (SUPABASE + LEGACY)
 * =========================
 */
const SUPABASE_ACCOUNTS_TABLE = "accounts_payable";
const SUPABASE_DRE_TABLE = "dre_configs";
const SUPABASE_DRE_ID = 1;
const LEGACY_STORAGE_KEY = "accounts-payable-data";
const LEGACY_DRE_STORAGE_KEY = "cq-dre-config";
const LEGACY_SCHEMA_VERSION_KEY = "cq-schema-version";

/**
 * =========================
 * DRE DEFAULT (BASE)
 * =========================
 */
const DEFAULT_DRE = {
  PESSOAL: {
    "Vale Transporte": ["370"],
    "Vale Transporte - Estagiárias": ["370"],
    "Bolsa Auxílio": ["377"],
    "Salários e encargos": ["119", "16", "125", "127", "131", "362", "365", "373", "383", "406", "658"],
    "Pro Labore": ["382"],
    "Empréstimo Sócio": ["658"],
    "Contingência Trabalhista": ["427"],
    "Plano de Saúde": ["371"],
    "PLR - Partic nos Lucros": ["490"],
    "PCMSO (Exame Médico)": ["383"],
  },
  IMPOSTOS: {
    "Impostos s/ Receita": ["167"],
    "Impostos e Taxas": ["444"],
    "Salários e encargos": ["125", "373", "127", "131"],
  },
  ESTRUTURA: {
    "Telefone e Internet": ["397", "398", "399"],
    "Água": ["391"],
    "Luz": ["390"],
    "Aluguel": ["385"],
    "Aluguel e IPTU": ["449"],
    "Seguro": ["394"],
    "Condomínio": ["391"],
    "Serviços Profissionais": ["406"],
    "Computadores e Periféricos": ["73"],
    "Brinquedos": ["500"],
    "Doação": ["477"],
    "Presente": [],
  },
  CARTÕES: {
    "Despesas com Cartão": [],
  },
  FORNECEDORES: {
    "Motoboy": ["395"],
    "Inglês": ["581"],
    "Material Didático": ["581"],
    "Software": ["657"],
    "Dedetização": ["388"],
    "Uniforme": ["479"],
    "Sistema": ["452", "657"],
    "Instalações": ["77"],
    "Supermercado": ["659"],
    "Estacionamento": ["425"],
    "Festa": ["423"],
    "Festa Junina": ["423"],
    "Manutenção": ["388"],
    "Benfeitorias": ["91"],
    "Limpeza e Conservação": ["416"],
    "Impostos e Taxas": ["444"],
    "Material Escolar": ["581"],
    "Computadores e Periféricos": ["73"],
    "Móveis e Utensílios": ["72"],
    "Brinquedos": ["500"],
    "Contingência Trabalhista": ["427"],
    "Serviços Profissionais": ["406", "376"],
    "Marketing": ["431"],
    "Transporte": ["370"],
    "Refeição": ["418"],
    "Despesas Judiciais": ["427"],
  },
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function formatBRL(n) {
  return (Number(n || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function parseMoneyBR(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (!s) return 0;
  const cleaned = s
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function safeDate(yyyyMmDd) {
  const d = new Date(yyyyMmDd);
  return isNaN(d.getTime()) ? null : d;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeCtaList(list) {
  return (Array.isArray(list) ? list : [])
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0);
}

function mergeDre(base, incoming) {
  const out = deepClone(base || {});
  const inc = incoming && typeof incoming === "object" ? incoming : {};
  Object.entries(inc).forEach(([groupName, subObj]) => {
    if (!out[groupName]) out[groupName] = {};
    const subIncoming = subObj && typeof subObj === "object" ? subObj : {};
    Object.entries(subIncoming).forEach(([subName, ctas]) => {
      if (!out[groupName][subName]) out[groupName][subName] = [];
      const set = new Set(normalizeCtaList(out[groupName][subName]));
      normalizeCtaList(ctas).forEach((c) => set.add(String(c)));
      out[groupName][subName] = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    });
  });
  return out;
}

function addMonthsToDate(yyyyMmDd, monthsToAdd) {
  const d = new Date(yyyyMmDd);
  if (isNaN(d.getTime())) return yyyyMmDd;

  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  const target = new Date(year, month + monthsToAdd, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * =========================
 * MIGRAÇÃO: padroniza estrutura
 * =========================
 */
function migrateAccountsIfNeeded(rawAccounts) {
  const list = Array.isArray(rawAccounts) ? rawAccounts : [];
  return list.map((a) => {
    const groupDre = a.groupDre || a.group || "";
    const subgroup = a.subgroup || a.subCategory || "";
    const cta = String(a.cta || a.account || "");
    const personSupplier = a.personSupplier || a.supplier || "";
    const amount = typeof a.amount === "number" ? a.amount : parseMoneyBR(a.amount);

    return {
      ...a,
      groupDre,
      subgroup,
      cta,
      personSupplier,
      amount,
      // compat
      group: groupDre,
      subCategory: subgroup,
      account: cta,
      supplier: personSupplier,
    };
  });
}

function mapAccountToDb(acc) {
  return {
    id: acc.id,
    description: acc.description || "",
    group_dre: acc.groupDre || acc.group || "",
    subgroup: acc.subgroup || acc.subCategory || "",
    cta: acc.cta || acc.account || "",
    person_supplier: acc.personSupplier || acc.supplier || "",
    due_date: acc.dueDate || null,
    amount: typeof acc.amount === "number" ? acc.amount : parseMoneyBR(acc.amount),
    payment_method: acc.paymentMethod || "",
    bank: acc.bank || "",
    obs: acc.obs || "",
    expense_type: acc.expenseType || "fixa",
    recurring: acc.recurring || "nao",
    payment_date: acc.paymentDate || null,
    payment_obs: acc.paymentObs || "",
    created_at: acc.createdAt || new Date().toISOString(),
    updated_at: acc.updatedAt || new Date().toISOString(),
  };
}

function mapDbToAccount(row) {
  return {
    id: row.id,
    description: row.description || "",
    groupDre: row.group_dre || "",
    subgroup: row.subgroup || "",
    cta: row.cta || "",
    personSupplier: row.person_supplier || "",
    dueDate: row.due_date || "",
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || "",
    bank: row.bank || "",
    obs: row.obs || "",
    expenseType: row.expense_type || "fixa",
    recurring: row.recurring || "nao",
    paymentDate: row.payment_date || "",
    paymentObs: row.payment_obs || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    // compat
    group: row.group_dre || "",
    subCategory: row.subgroup || "",
    account: row.cta || "",
    supplier: row.person_supplier || "",
  };
}

function readLegacyAccounts() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return migrateAccountsIfNeeded(parsed);
  } catch (e) {
    console.error("Erro ao ler contas locais:", e);
    return [];
  }
}

function readLegacyDreConfig() {
  try {
    const raw = localStorage.getItem(LEGACY_DRE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    console.error("Erro ao ler DRE local:", e);
    return null;
  }
}

export default function AccountsPayableSystem() {
  const confirmAction = (msg) => window.confirm(msg);

  /**
   * =========================
   * INLINE EDIT (CENÁRIO 1) + CONFIRMAÇÃO
   * =========================
   */
  const [editingCell, setEditingCell] = useState(null); // { id, field } | null
  const [pendingEdit, setPendingEdit] = useState(null); // { id, field, oldValue, newValue } | null
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);

  const fieldLabels = {
    dueDate: "Vencimento",
    description: "Descrição",
    groupDre: "Grupo DRE",
    subgroup: "Subgrupo",
    cta: "CTA",
    amount: "Valor",
    personSupplier: "Pessoa/Fornecedor",
    bank: "Banco",
    paymentMethod: "Forma Pagamento",
    obs: "Obs",
    expenseType: "Tipo (fixa/variável)",
    recurring: "Recorrente (sim/não)",
  };

  /**
   * AUTH
   */
  const [isAuthed, setIsAuthed] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        console.error("Erro ao obter sessão:", error);
        setIsAuthed(false);
        return;
      }
      setIsAuthed(Boolean(data.session));
    };

    void initAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
    });

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const doLogin = async () => {
    const email = loginUser.trim();
    const password = loginPass;
    if (!email || !password) {
      alert("Informe e-mail e senha.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Usuário ou senha inválidos.");
      return;
    }
    setLoginPass("");
  };

  const doLogout = async () => {
    if (!confirmAction("Confirmar saída do sistema?")) return;
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Erro ao sair:", error);
    setIsAuthed(false);
    setLoginUser("");
    setLoginPass("");
  };

  /**
   * DRE CONFIG
   */
  const [dreConfig, setDreConfig] = useState(deepClone(DEFAULT_DRE));

  const loadDreConfig = async () => {
    try {
      const { data, error } = await supabase
        .from(SUPABASE_DRE_TABLE)
        .select("config")
        .eq("id", SUPABASE_DRE_ID)
        .maybeSingle();

      if (error) throw error;

      if (data?.config) {
        setDreConfig(mergeDre(DEFAULT_DRE, data.config));
        return;
      }

      const legacyConfig = readLegacyDreConfig();
      const nextConfig = legacyConfig ? mergeDre(DEFAULT_DRE, legacyConfig) : deepClone(DEFAULT_DRE);

      const { error: upsertError } = await supabase
        .from(SUPABASE_DRE_TABLE)
        .upsert({ id: SUPABASE_DRE_ID, config: nextConfig, updated_at: new Date().toISOString() });

      if (upsertError) throw upsertError;

      localStorage.removeItem(LEGACY_DRE_STORAGE_KEY);
      setDreConfig(nextConfig);
    } catch (e) {
      console.error("Erro ao carregar DRE:", e);
      setDreConfig(deepClone(DEFAULT_DRE));
    }
  };

  const saveDreConfig = async (next) => {
    try {
      const { error } = await supabase
        .from(SUPABASE_DRE_TABLE)
        .upsert({ id: SUPABASE_DRE_ID, config: next, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (e) {
      console.error("Erro ao salvar DRE:", e);
    }
  };

  useEffect(() => {
    void loadDreConfig();
  }, []);

  /**
   * ACCOUNTS
   */
  const [accounts, setAccounts] = useState([]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from(SUPABASE_ACCOUNTS_TABLE)
        .select("*")
        .order("due_date", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setAccounts(data.map(mapDbToAccount));
        return;
      }

      const legacyAccounts = readLegacyAccounts();
      if (legacyAccounts.length > 0) {
        const payload = legacyAccounts.map((acc) => mapAccountToDb(acc));
        const { error: upsertError } = await supabase
          .from(SUPABASE_ACCOUNTS_TABLE)
          .upsert(payload, { onConflict: "id" });

        if (upsertError) throw upsertError;

        localStorage.removeItem(LEGACY_STORAGE_KEY);
        localStorage.removeItem(LEGACY_SCHEMA_VERSION_KEY);
        setAccounts(legacyAccounts);
        return;
      }

      setAccounts([]);
    } catch (e) {
      console.error("Erro ao carregar contas:", e);
      setAccounts([]);
    }
  };

  const saveData = async (data) => {
    try {
      const payload = data.map((acc) => mapAccountToDb(acc));
      const { error } = await supabase
        .from(SUPABASE_ACCOUNTS_TABLE)
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
    } catch (e) {
      console.error("Erro ao salvar:", e);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  /**
   * Helpers para inline edit
   */
  const getAccountFieldValue = (acc, field) => {
    if (!acc) return "";
    if (field === "cta") return acc.cta ?? acc.account ?? "";
    if (field === "groupDre") return acc.groupDre ?? acc.group ?? "";
    if (field === "subgroup") return acc.subgroup ?? acc.subCategory ?? "";
    if (field === "personSupplier") return acc.personSupplier ?? acc.supplier ?? "";
    return acc[field] ?? "";
  };

  const requestEditConfirm = (acc, field, newValueRaw) => {
    const oldValue = getAccountFieldValue(acc, field);

    let newValue = newValueRaw;

    if (field === "amount") {
      const n = typeof newValueRaw === "number"
        ? newValueRaw
        : parseFloat(String(newValueRaw).replace(",", "."));
      newValue = Number.isFinite(n) ? n : oldValue;
    }

    if (field === "dueDate" || field === "paymentDate") {
      newValue = String(newValueRaw || "").trim();
    }

    if (field === "cta") newValue = String(newValueRaw || "").trim();
    if (field === "groupDre" || field === "subgroup") newValue = String(newValueRaw || "").trim();
    if (field === "personSupplier" || field === "bank" || field === "obs") newValue = String(newValueRaw || "");

    if (String(oldValue ?? "") === String(newValue ?? "")) {
      setEditingCell(null);
      return;
    }

    setPendingEdit({ id: acc.id, field, oldValue, newValue });
    setShowConfirmEdit(true);
    setEditingCell(null);
  };

  const applyPendingEdit = () => {
    if (!pendingEdit) return;

    const { id, field, newValue } = pendingEdit;

    const newAccounts = accounts.map((acc) => {
      if (acc.id !== id) return acc;

      // base atual
      const currentGroup = acc.groupDre || acc.group || "";
      const currentSub = acc.subgroup || acc.subCategory || "";
      const currentCta = String(acc.cta || acc.account || "");

      // altera respeitando validação cruzada DRE
      if (field === "groupDre") {
        const nextGroup = String(newValue || "");
        const nextSubgroups = Object.keys(dreConfig?.[nextGroup] || {});
        const keepSub = nextSubgroups.includes(currentSub) ? currentSub : "";
        const nextCtas = normalizeCtaList(dreConfig?.[nextGroup]?.[keepSub] || []);
        const keepCta = keepSub && nextCtas.includes(currentCta) ? currentCta : "";

        return {
          ...acc,
          groupDre: nextGroup,
          subgroup: keepSub,
          cta: keepCta,
          // compat
          group: nextGroup,
          subCategory: keepSub,
          account: keepCta,
          updatedAt: new Date().toISOString(),
        };
      }

      if (field === "subgroup") {
        const nextSub = String(newValue || "");
        const g = currentGroup;
        const nextCtas = normalizeCtaList(dreConfig?.[g]?.[nextSub] || []);
        const keepCta = nextCtas.includes(currentCta) ? currentCta : "";

        return {
          ...acc,
          subgroup: nextSub,
          cta: keepCta,
          // compat
          subCategory: nextSub,
          account: keepCta,
          updatedAt: new Date().toISOString(),
        };
      }

      if (field === "cta") {
        const ctaStr = String(newValue || "");
        return {
          ...acc,
          cta: ctaStr,
          account: ctaStr,
          updatedAt: new Date().toISOString(),
        };
      }

      if (field === "personSupplier") {
        return {
          ...acc,
          personSupplier: newValue,
          supplier: newValue,
          updatedAt: new Date().toISOString(),
        };
      }

      if (field === "amount") {
        return {
          ...acc,
          amount: Number(newValue || 0),
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...acc,
        [field]: newValue,
        updatedAt: new Date().toISOString(),
      };
    });

    setAccounts(newAccounts);
    saveData(newAccounts);
    setShowConfirmEdit(false);
    setPendingEdit(null);
  };

  const cancelPendingEdit = () => {
    setShowConfirmEdit(false);
    setPendingEdit(null);
    setEditingCell(null);
  };

  /**
   * UI STATE
   */
  const [view, setView] = useState("dashboard"); // dashboard | list | reports | settings
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [filters, setFilters] = useState({
    period: "month", // today | week | month | all
    status: "all", // all | pending | paid | overdue
    groupDre: "all",
    search: "",
  });

  // relatório
  const [reportMode, setReportMode] = useState("range"); // range | month | year
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportStart, setReportStart] = useState(todayIso());
  const [reportEnd, setReportEnd] = useState(todayIso());
  const [reportGroup, setReportGroup] = useState("all");
  const [reportSubgroup, setReportSubgroup] = useState("all");
  const [reportCta, setReportCta] = useState("all");
  const [reportStatus, setReportStatus] = useState("all");
  const [reportExpenseType, setReportExpenseType] = useState("all");
  const [reportRecurring, setReportRecurring] = useState("all");

  // pagamento modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [paymentData, setPaymentData] = useState({
    paymentDate: "",
    bank: "",
    paymentMethod: "",
    paymentObs: "",
  });

  /**
   * FORM
   */
  const emptyForm = {
    description: "",
    groupDre: "",
    subgroup: "",
    cta: "",
    personSupplier: "",
    dueDate: "",
    amount: "",
    paymentMethod: "",
    bank: "",
    obs: "",
    expenseType: "fixa",
    recurring: "nao",
  };

  const [formData, setFormData] = useState({ ...emptyForm });
  const resetForm = () => setFormData({ ...emptyForm });

  const groupsList = useMemo(() => Object.keys(dreConfig || {}), [dreConfig]);

  const subgroupsList = useMemo(() => {
    if (!formData.groupDre || !dreConfig?.[formData.groupDre]) return [];
    return Object.keys(dreConfig[formData.groupDre] || {});
  }, [formData.groupDre, dreConfig]);

  const ctasList = useMemo(() => {
    if (!formData.groupDre || !formData.subgroup) return [];
    return normalizeCtaList(dreConfig?.[formData.groupDre]?.[formData.subgroup] || []);
  }, [formData.groupDre, formData.subgroup, dreConfig]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  };

  const openEdit = (acc) => {
    setEditingId(acc.id);
    setFormData({
      description: acc.description || "",
      groupDre: acc.groupDre || acc.group || "",
      subgroup: acc.subgroup || acc.subCategory || "",
      cta: String(acc.cta || acc.account || ""),
      personSupplier: acc.personSupplier || acc.supplier || "",
      dueDate: acc.dueDate || "",
      amount: String(acc.amount ?? ""),
      paymentMethod: acc.paymentMethod || "",
      bank: acc.bank || "",
      obs: acc.obs || "",
      expenseType: acc.expenseType || "fixa",
      recurring: acc.recurring || "nao",
    });
    setShowForm(true);
  };

  /**
   * STATUS (sempre calculado)
   */
  const getAccountStatus = (acc) => {
    if (acc.paymentDate && String(acc.paymentDate).trim() !== "") return "paid";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(acc.dueDate);
    if (isNaN(due.getTime())) return "pending";
    due.setHours(0, 0, 0, 0);
    return due < today ? "overdue" : "pending";
  };

  /**
   * CRUD CONTAS
   */
  const handleSubmit = () => {
    if (!formData.description || !formData.groupDre || !formData.subgroup || !formData.dueDate || !formData.amount) {
      alert("Por favor, preencha os campos obrigatórios (*).");
      return;
    }

    const payload = {
      ...formData,
      amount: parseMoneyBR(formData.amount),
      updatedAt: new Date().toISOString(),
      // compat antigos:
      group: formData.groupDre,
      subCategory: formData.subgroup,
      account: formData.cta,
      supplier: formData.personSupplier,
    };

    if (editingId) {
      if (!confirmAction("Você está alterando uma conta existente.\n\nConfirmar alterações e salvar?")) return;

      const newAccounts = accounts.map((a) => (a.id === editingId ? { ...a, ...payload } : a));
      setAccounts(newAccounts);
      saveData(newAccounts);
      closeForm();
      return;
    }

    const newAcc = {
      ...payload,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      paymentDate: "",
      paymentObs: "",
    };

    const newAccounts = [...accounts, newAcc];
    setAccounts(newAccounts);
    saveData(newAccounts);
    closeForm();
  };

  const deleteAccount = async (id) => {
    if (!confirmAction("Confirma a exclus??o desta conta?")) return;
    const newAccounts = accounts.filter((a) => a.id !== id);
    setAccounts(newAccounts);
    try {
      const { error } = await supabase.from(SUPABASE_ACCOUNTS_TABLE).delete().eq("id", id);
      if (error) throw error;
    } catch (e) {
      console.error("Erro ao excluir:", e);
    }
    void saveData(newAccounts);
  };

  /**
   * PAGAMENTO
   */
  const openPayment = (acc) => {
    setPayingId(acc.id);
    setPaymentData({
      paymentDate: todayIso(),
      bank: acc.bank || "",
      paymentMethod: acc.paymentMethod || "",
      paymentObs: "",
    });
    setShowPaymentModal(true);
  };

  const closePayment = () => {
    setShowPaymentModal(false);
    setPayingId(null);
    setPaymentData({ paymentDate: "", bank: "", paymentMethod: "", paymentObs: "" });
  };

  const confirmPayment = () => {
    if (!paymentData.paymentDate) {
      alert("Informe a data do pagamento.");
      return;
    }

    if (!confirmAction("Você está marcando uma conta como PAGA.\n\nConfirmar e salvar?")) return;

    const newAccounts = accounts.map((acc) =>
      acc.id === payingId
        ? {
            ...acc,
            paymentDate: paymentData.paymentDate,
            bank: paymentData.bank,
            paymentMethod: paymentData.paymentMethod,
            paymentObs: paymentData.paymentObs,
            updatedAt: new Date().toISOString(),
          }
        : acc
    );

    setAccounts(newAccounts);
    saveData(newAccounts);
    closePayment();
  };

  /**
   * DASHBOARD/LISTA - filtros
   */
  const getFilteredAccounts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return accounts.filter((acc) => {
      const due = safeDate(acc.dueDate);
      if (!due) return false;
      due.setHours(0, 0, 0, 0);

      if (filters.period === "today" && due.getTime() !== today.getTime()) return false;
      if (filters.period === "week") {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (due < today || due > weekEnd) return false;
      }
      if (filters.period === "month") {
        if (due.getMonth() !== today.getMonth() || due.getFullYear() !== today.getFullYear()) return false;
      }

      const st = getAccountStatus(acc);
      if (filters.status !== "all" && st !== filters.status) return false;

      const g = acc.groupDre || acc.group;
      if (filters.groupDre !== "all" && g !== filters.groupDre) return false;

      if (filters.search) {
        const s = filters.search.toLowerCase();
        const supplier = (acc.personSupplier || acc.supplier || "").toLowerCase();
        const desc = (acc.description || "").toLowerCase();
        if (!desc.includes(s) && !supplier.includes(s)) return false;
      }

      return true;
    });
  };

  const calculateTotals = () => {
    const filtered = getFilteredAccounts();
    const t = { projected: 0, paid: 0, pending: 0, overdue: 0 };

    filtered.forEach((acc) => {
      t.projected += Number(acc.amount || 0);
      const st = getAccountStatus(acc);
      if (st === "paid") t.paid += Number(acc.amount || 0);
      else if (st === "overdue") t.overdue += Number(acc.amount || 0);
      else t.pending += Number(acc.amount || 0);
    });

    return t;
  };

  const totals = calculateTotals();

  /**
   * RELATÓRIOS
   */
  const getRowsForReport = () => {
    let rows = [...accounts].filter((acc) => {
      const d = safeDate(acc.dueDate);
      if (!d) return false;

      if (reportMode === "month") return d.getMonth() === reportMonth && d.getFullYear() === reportYear;
      if (reportMode === "year") return d.getFullYear() === reportYear;

      const s = safeDate(reportStart);
      const e = safeDate(reportEnd);
      if (!s || !e) return true;
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      return d >= s && d <= e;
    });

    if (reportGroup !== "all") rows = rows.filter((a) => (a.groupDre || a.group) === reportGroup);
    if (reportSubgroup !== "all") rows = rows.filter((a) => (a.subgroup || a.subCategory || "") === reportSubgroup);
    if (reportCta !== "all") rows = rows.filter((a) => String(a.cta || a.account || "") === String(reportCta));
    if (reportStatus !== "all") rows = rows.filter((a) => getAccountStatus(a) === reportStatus);
    if (reportExpenseType !== "all") rows = rows.filter((a) => (a.expenseType || "fixa") === reportExpenseType);
    if (reportRecurring !== "all") rows = rows.filter((a) => (a.recurring || "nao") === reportRecurring);

    return rows;
  };

  const reportRows = useMemo(() => getRowsForReport(), [
    accounts,
    reportMode, reportMonth, reportYear, reportStart, reportEnd,
    reportGroup, reportSubgroup, reportCta,
    reportStatus, reportExpenseType, reportRecurring,
  ]);

  const reportTotals = useMemo(() => {
    const t = { projected: 0, paid: 0, pending: 0, overdue: 0 };
    reportRows.forEach((acc) => {
      t.projected += Number(acc.amount || 0);
      const st = getAccountStatus(acc);
      if (st === "paid") t.paid += Number(acc.amount || 0);
      else if (st === "overdue") t.overdue += Number(acc.amount || 0);
      else t.pending += Number(acc.amount || 0);
    });
    return t;
  }, [reportRows]);

  const reportByGroupSubgroupCta = useMemo(() => {
    const out = {};
    reportRows.forEach((acc) => {
      const g = acc.groupDre || acc.group || "SEM GRUPO";
      const sg = acc.subgroup || acc.subCategory || "SEM SUBGRUPO";
      const cta = String(acc.cta || acc.account || "SEM CTA");
      const st = getAccountStatus(acc);

      if (!out[g]) out[g] = {};
      if (!out[g][sg]) out[g][sg] = {};
      if (!out[g][sg][cta]) out[g][sg][cta] = { projected: 0, paid: 0, pending: 0, overdue: 0 };

      out[g][sg][cta].projected += Number(acc.amount || 0);
      if (st === "paid") out[g][sg][cta].paid += Number(acc.amount || 0);
      else if (st === "overdue") out[g][sg][cta].overdue += Number(acc.amount || 0);
      else out[g][sg][cta].pending += Number(acc.amount || 0);
    });
    return out;
  }, [reportRows]);

  const reportGroupsAvailable = useMemo(() => Object.keys(dreConfig), [dreConfig]);
  const reportSubgroupsAvailable = useMemo(() => {
    if (reportGroup === "all") return [];
    return Object.keys(dreConfig[reportGroup] || {});
  }, [reportGroup, dreConfig]);
  const reportCtasAvailable = useMemo(() => {
    if (reportGroup === "all" || reportSubgroup === "all") return [];
    return normalizeCtaList(dreConfig[reportGroup]?.[reportSubgroup] || []);
  }, [reportGroup, reportSubgroup, dreConfig]);

  /**
   * EXPORT RELATÓRIO (Excel com Info + data/hora)
   */
  const exportReportToExcel = (rows, title) => {
    const generatedAt = new Date().toLocaleString("pt-BR");

    const info = [
      { Campo: "Empresa", Valor: COMPANY_NAME },
      { Campo: "CNPJ", Valor: COMPANY_CNPJ },
      { Campo: "Relatório", Valor: title },
      { Campo: "Gerado em", Valor: generatedAt },
      { Campo: "Total Projetado", Valor: reportTotals.projected },
      { Campo: "Total Pago", Valor: reportTotals.paid },
      { Campo: "Total Pendente", Valor: reportTotals.pending },
      { Campo: "Total Vencido", Valor: reportTotals.overdue },
    ];

    const detalhado = [];
    Object.entries(reportByGroupSubgroupCta).forEach(([g, subMap]) => {
      Object.entries(subMap).forEach(([sg, ctaMap]) => {
        Object.entries(ctaMap).forEach(([cta, d]) => {
          detalhado.push({
            "Grupo DRE": g,
            Subgrupo: sg,
            CTA: cta,
            Projetado: d.projected,
            Pago: d.paid,
            Pendente: d.pending,
            Vencido: d.overdue,
            "A pagar": d.pending + d.overdue,
          });
        });
      });
    });

    const contas = rows
      .slice()
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .map((acc) => {
        const st = getAccountStatus(acc);
        return {
          Vencimento: acc.dueDate,
          "Grupo DRE": acc.groupDre || acc.group || "",
          Subgrupo: acc.subgroup || acc.subCategory || "",
          CTA: acc.cta || acc.account || "",
          Descrição: acc.description || "",
          "Fornecedor/Pessoa": acc.personSupplier || acc.supplier || "",
          Valor: Number(acc.amount || 0),
          Status: st === "paid" ? "Pago" : st === "overdue" ? "Vencido" : "Pendente",
          "Data Pagamento": acc.paymentDate || "",
          "Forma Pagamento": acc.paymentMethod || "",
          Banco: acc.bank || "",
          Obs: acc.obs || "",
          "Obs Pagamento": acc.paymentObs || "",
          Tipo: acc.expenseType || "",
          Recorrente: acc.recurring || "",
        };
      });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Info");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhado), "Detalhado");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contas), "Contas");

    XLSX.writeFile(wb, `relatorio_${nowStamp()}.xlsx`);
  };

  const exportReportCurrent = () => {
    const title =
      reportMode === "month"
        ? `Mensal ${monthNames[reportMonth]}/${reportYear}`
        : reportMode === "year"
          ? `Anual ${reportYear}`
          : `Período ${reportStart} até ${reportEnd}`;
    exportReportToExcel(reportRows, title);
  };

  /**
   * RECORRENTES → gerar próximo mês (baseado no mês/ano do relatório mensal)
   */
  const generateNextMonthRecurring = () => {
    const base = reportMode === "month"
      ? new Date(reportYear, reportMonth, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const nextMonthDate = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const nextM = nextMonthDate.getMonth();
    const nextY = nextMonthDate.getFullYear();

    const recurring = accounts.filter((a) => (a.recurring || "nao") === "sim");
    if (recurring.length === 0) {
      alert('Nenhuma conta recorrente marcada como "Sim".');
      return;
    }

    if (!confirmAction(`Gerar contas recorrentes para ${monthNames[nextM]}/${nextY}?\n\nO sistema evita duplicar contas iguais.`)) return;

    const newOnes = recurring
      .map((a, idx) => {
        const newDue = addMonthsToDate(a.dueDate, 1);

        const alreadyExists = accounts.some((x) =>
          (x.description || "") === (a.description || "") &&
          (x.dueDate || "") === newDue &&
          Number(x.amount || 0) === Number(a.amount || 0) &&
          String(x.cta || x.account || "") === String(a.cta || a.account || "")
        );

        if (alreadyExists) return null;

        return {
          ...a,
          id: Date.now() + idx,
          dueDate: newDue,
          paymentDate: "",
          paymentObs: "",
          paymentMethod: "",
          status: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (newOnes.length === 0) {
      alert("Já existem recorrentes geradas para o próximo mês (nenhuma nova foi criada).");
      return;
    }

    const merged = [...accounts, ...newOnes];
    setAccounts(merged);
    saveData(merged);
    alert(`✅ ${newOnes.length} contas recorrentes foram geradas para ${monthNames[nextM]}/${nextY}.`);

    setReportMode("month");
    setReportMonth(nextM);
    setReportYear(nextY);
  };

  /**
   * BACKUP/RESTORE
   */
  const exportBackup = () => {
    const payload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      accounts,
      dreConfig,
      company: { name: COMPANY_NAME, cnpj: COMPANY_CNPJ },
    };

    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-contas-querubins_${nowStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importBackup = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        const importedAccounts = Array.isArray(imported) ? imported : imported?.accounts;
        const importedDre = Array.isArray(imported) ? null : imported?.dreConfig;

        if (!Array.isArray(importedAccounts)) {
          alert("Backup inválido.");
          return;
        }

        if (!confirmAction("Você vai SUBSTITUIR todos os dados atuais pelo backup.\n\nConfirmar restauração?")) return;

        const migrated = migrateAccountsIfNeeded(importedAccounts);
        setAccounts(migrated);
        saveData(migrated);

        if (importedDre && typeof importedDre === "object") {
          setDreConfig(importedDre);
          saveDreConfig(importedDre);
        }

        alert(`✅ Backup restaurado. Contas: ${migrated.length}`);
      } catch (err) {
        alert("Erro ao importar backup. Verifique se é um JSON válido.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  /**
   * IMPORTAR EXCEL (tenta ler: Grupo DRE / Subgrupo / CTA / Descrição / DIA VENC. / VALOR)
   */
  const importFromSpreadsheet = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        const importedAccounts = [];
        json.forEach((row, idx) => {
          const groupDre = String(row["Grupo DRE"] || row["GRUPO DRE"] || row["Grupo"] || row["GRUPO"] || "").trim();
          const subgroup = String(row["Subgrupo"] || row["SUBGRUPO"] || "").trim();
          const cta = String(row["CTA"] || row["Cta"] || "").trim();
          const desc = String(row["DESCRIÇÃO"] || row["Descrição"] || row["DESCRICAO"] || "").trim();
          const diaVenc = row["DIA VENC."] || row["DIA VENC"] || row["Dia Venc"] || "";
          const valor = row["VALOR"] || row["Valor"] || 0;

          if (!desc) return;

          let dueDate = "";
          const day = parseInt(diaVenc, 10);
          if (day >= 1 && day <= 31) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, "0");
            const d = String(day).padStart(2, "0");
            dueDate = `${y}-${m}-${d}`;
          }

          const amount = parseMoneyBR(valor);
          if (!dueDate || amount <= 0) return;

          importedAccounts.push({
            id: Date.now() + idx,
            description: desc,
            groupDre,
            subgroup,
            cta,
            personSupplier: "",
            dueDate,
            amount,
            bank: "",
            obs: "",
            paymentDate: "",
            paymentMethod: "",
            paymentObs: "",
            expenseType: "fixa",
            recurring: "nao",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // compat
            group: groupDre,
            subCategory: subgroup,
            account: cta,
            supplier: "",
          });
        });

        if (importedAccounts.length === 0) {
          alert("❌ Nenhuma conta válida encontrada no arquivo.");
          return;
        }

        const msg =
          `Encontradas ${importedAccounts.length} contas válidas.\n\n` +
          `Deseja SUBSTITUIR ou ADICIONAR?\n\n` +
          `OK = SUBSTITUIR\nCancelar = ADICIONAR`;

        if (confirmAction(msg)) {
          setAccounts(importedAccounts);
          saveData(importedAccounts);
        } else {
          const merged = [...accounts, ...importedAccounts];
          setAccounts(merged);
          saveData(merged);
        }

        alert(`✅ Importação concluída: ${importedAccounts.length} contas.`);
      } catch (err) {
        alert("Erro ao importar planilha: " + err.message);
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  /**
   * SETTINGS - CRUD DRE + Export/Import config
   */
  const [newGroupName, setNewGroupName] = useState("");
  const [newSubgroupName, setNewSubgroupName] = useState("");
  const [newCtaValue, setNewCtaValue] = useState("");

  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedSubgroup, setSelectedSubgroup] = useState("");

  const settingsGroups = useMemo(() => Object.keys(dreConfig), [dreConfig]);
  const settingsSubgroups = useMemo(() => {
    if (!selectedGroup) return [];
    return Object.keys(dreConfig[selectedGroup] || {});
  }, [selectedGroup, dreConfig]);

  const settingsCtas = useMemo(() => {
    if (!selectedGroup || !selectedSubgroup) return [];
    return normalizeCtaList(dreConfig[selectedGroup]?.[selectedSubgroup] || []);
  }, [selectedGroup, selectedSubgroup, dreConfig]);

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return alert("Informe o nome do Grupo DRE.");
    if (dreConfig[name]) return alert("Esse Grupo DRE já existe.");
    if (!confirmAction(`Criar o Grupo DRE "${name}"?`)) return;

    const next = deepClone(dreConfig);
    next[name] = {};
    setDreConfig(next);
    saveDreConfig(next);
    setNewGroupName("");
  };

  const renameGroup = (oldName) => {
    const newName = prompt(`Renomear Grupo DRE "${oldName}" para:`, oldName);
    if (!newName) return;
    const nn = newName.trim();
    if (!nn) return;
    if (nn === oldName) return;
    if (dreConfig[nn]) return alert("Já existe um grupo com esse nome.");

    const updateAccountsToo = confirmAction(
      `Você vai renomear "${oldName}" → "${nn}".\n\nOK = Atualizar também as contas já cadastradas\nCancelar = Só DRE`
    );

    if (!confirmAction(`Confirmar renomear o grupo "${oldName}" para "${nn}"?`)) return;

    const next = deepClone(dreConfig);
    next[nn] = next[oldName];
    delete next[oldName];

    setDreConfig(next);
    saveDreConfig(next);

    if (updateAccountsToo) {
      const newAccounts = accounts.map((a) => {
        const g = a.groupDre || a.group;
        if (g === oldName) return { ...a, groupDre: nn, group: nn };
        return a;
      });
      setAccounts(newAccounts);
      saveData(newAccounts);
    }

    if (selectedGroup === oldName) setSelectedGroup(nn);
  };

  const deleteGroup = (name) => {
    const msg =
      `Excluir o Grupo DRE "${name}"?\n\n` +
      `Isso remove Subgrupos/CTAs do grupo.\n` +
      `As contas não serão apagadas (podem ficar com DRE órfão).`;
    if (!confirmAction(msg)) return;

    const next = deepClone(dreConfig);
    delete next[name];
    setDreConfig(next);
    saveDreConfig(next);

    if (selectedGroup === name) {
      setSelectedGroup("");
      setSelectedSubgroup("");
    }
  };

  const addSubgroup = () => {
    if (!selectedGroup) return alert("Selecione um Grupo DRE primeiro.");
    const name = newSubgroupName.trim();
    if (!name) return alert("Informe o nome do Subgrupo.");
    const groupObj = dreConfig[selectedGroup] || {};
    if (groupObj[name]) return alert("Esse Subgrupo já existe nesse grupo.");
    if (!confirmAction(`Criar o Subgrupo "${name}" em "${selectedGroup}"?`)) return;

    const next = deepClone(dreConfig);
    next[selectedGroup][name] = [];
    setDreConfig(next);
    saveDreConfig(next);
    setNewSubgroupName("");
  };

  const renameSubgroup = (oldName) => {
    const newName = prompt(`Renomear Subgrupo "${oldName}" para:`, oldName);
    if (!newName) return;
    const nn = newName.trim();
    if (!nn) return;
    if (nn === oldName) return;

    const groupObj = dreConfig[selectedGroup] || {};
    if (groupObj[nn]) return alert("Já existe um Subgrupo com esse nome.");

    const updateAccountsToo = confirmAction(
      `Você vai renomear "${oldName}" → "${nn}".\n\nOK = Atualizar também as contas já cadastradas\nCancelar = Só DRE`
    );

    if (!confirmAction(`Confirmar renomear o subgrupo "${oldName}" para "${nn}"?`)) return;

    const next = deepClone(dreConfig);
    next[selectedGroup][nn] = next[selectedGroup][oldName];
    delete next[selectedGroup][oldName];

    setDreConfig(next);
    saveDreConfig(next);

    if (updateAccountsToo) {
      const newAccounts = accounts.map((a) => {
        const g = a.groupDre || a.group;
        const sg = a.subgroup || a.subCategory;
        if (g === selectedGroup && sg === oldName) {
          return { ...a, subgroup: nn, subCategory: nn };
        }
        return a;
      });
      setAccounts(newAccounts);
      saveData(newAccounts);
    }

    if (selectedSubgroup === oldName) setSelectedSubgroup(nn);
  };

  const deleteSubgroup = (name) => {
    const msg =
      `Excluir o Subgrupo "${name}" em "${selectedGroup}"?\n\n` +
      `As contas não serão apagadas (podem ficar com Subgrupo órfão).`;
    if (!confirmAction(msg)) return;

    const next = deepClone(dreConfig);
    delete next[selectedGroup][name];
    setDreConfig(next);
    saveDreConfig(next);

    if (selectedSubgroup === name) setSelectedSubgroup("");
  };

  const addCta = () => {
    if (!selectedGroup || !selectedSubgroup) return alert("Selecione Grupo e Subgrupo.");
    const cta = newCtaValue.trim();
    if (!cta) return alert("Informe o CTA.");

    const list = normalizeCtaList(dreConfig[selectedGroup]?.[selectedSubgroup] || []);
    if (list.includes(cta)) return alert("Esse CTA já existe nesse Subgrupo.");
    if (!confirmAction(`Adicionar CTA "${cta}" em "${selectedGroup} > ${selectedSubgroup}"?`)) return;

    const next = deepClone(dreConfig);
    next[selectedGroup][selectedSubgroup] = normalizeCtaList([...(next[selectedGroup][selectedSubgroup] || []), cta]);
    setDreConfig(next);
    saveDreConfig(next);
    setNewCtaValue("");
  };

  const removeCta = (cta) => {
    const msg =
      `Remover o CTA "${cta}" de "${selectedGroup} > ${selectedSubgroup}"?\n\n` +
      `Obs: contas com esse CTA não serão apagadas.`;
    if (!confirmAction(msg)) return;

    const next = deepClone(dreConfig);
    next[selectedGroup][selectedSubgroup] = normalizeCtaList(next[selectedGroup][selectedSubgroup] || []).filter(
      (x) => String(x) !== String(cta)
    );
    setDreConfig(next);
    saveDreConfig(next);
  };

  const exportDreConfig = () => {
    const dataStr = JSON.stringify(dreConfig, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dre-config_${nowStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importDreConfig = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const incoming = JSON.parse(e.target.result);
        if (!incoming || typeof incoming !== "object") {
          alert("Arquivo inválido para DRE.");
          return;
        }

        const replace = confirmAction(
          `Importar DRE:\n\nOK = SUBSTITUIR (apaga atual)\nCancelar = MESCLAR (une itens)\n\nAs contas não serão apagadas.`
        );

        if (replace) {
          if (!confirmAction("Confirmar SUBSTITUIR o DRE atual pelo arquivo?")) return;
          setDreConfig(incoming);
          saveDreConfig(incoming);
          alert("✅ DRE substituído.");
        } else {
          if (!confirmAction("Confirmar MESCLAR o DRE do arquivo com o atual?")) return;
          const merged = mergeDre(dreConfig, incoming);
          setDreConfig(merged);
          saveDreConfig(merged);
          alert("✅ DRE mesclado.");
        }
      } catch (err) {
        alert("Erro ao importar DRE. Verifique se é um JSON válido.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  /**
   * LOGIN SCREEN
   */
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md border-t-4 border-blue-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
              <Lock className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Colégio Querubin's</h1>
              <p className="text-sm text-gray-600">Acesso ao Sistema de Contas a Pagar</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
              <input
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="w-full border rounded-lg px-4 py-2"
                placeholder="seu e-mail"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full border rounded-lg px-4 py-2"
                placeholder="sua senha"
              />
            </div>

            <button
              onClick={doLogin}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-md transition"
            >
              Entrar
            </button>

            <p className="text-xs text-gray-500 text-center">
              Dica: após entrar, o sistema lembra o acesso neste navegador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * MAIN UI
   */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-t-4 border-blue-500">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <img src={logoQuerubins} alt="Colégio Querubin's" className="h-16 w-16 object-contain" />
              <div>
                <h1 className="text-2xl font-bold text-blue-600">Colégio Querubin's</h1>
                <p className="text-sm text-gray-600">Sistema de Contas a Pagar</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportBackup}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm shadow-md transition"
              >
                <Download size={18} /> Exportar Backup (com DRE)
              </button>

              <label className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 cursor-pointer text-sm shadow-md transition">
                <FileSpreadsheet size={18} /> Importar Excel
                <input type="file" accept=".xlsx,.xls,.csv" onChange={importFromSpreadsheet} className="hidden" />
              </label>

              <label className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 cursor-pointer text-sm shadow-md transition">
                <Upload size={18} /> Restaurar Backup
                <input type="file" accept=".json" onChange={importBackup} className="hidden" />
              </label>

              <button
                onClick={() => {
                  setEditingId(null);
                  resetForm();
                  setShowForm(true);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 text-sm shadow-md transition"
              >
                <Plus size={18} /> Nova Conta
              </button>

              <button
                onClick={doLogout}
                className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm shadow-sm transition"
              >
                <LogOut size={18} /> Sair
              </button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex flex-wrap gap-4 border-b border-blue-100">
            <button
              onClick={() => setView("dashboard")}
              className={
                "pb-3 px-4 font-medium transition " +
                (view === "dashboard" ? "border-b-4 border-blue-500 text-blue-600" : "text-gray-600 hover:text-blue-500")
              }
            >
              📊 Dashboard
            </button>

            <button
              onClick={() => setView("list")}
              className={
                "pb-3 px-4 font-medium transition " +
                (view === "list" ? "border-b-4 border-blue-500 text-blue-600" : "text-gray-600 hover:text-blue-500")
              }
            >
              📋 Lista de Contas
            </button>

            <button
              onClick={() => setView("reports")}
              className={
                "pb-3 px-4 font-medium transition " +
                (view === "reports" ? "border-b-4 border-blue-500 text-blue-600" : "text-gray-600 hover:text-blue-500")
              }
            >
              📈 Relatórios
            </button>

            <button
              onClick={() => setView("settings")}
              className={
                "pb-3 px-4 font-medium transition " +
                (view === "settings" ? "border-b-4 border-blue-500 text-blue-600" : "text-gray-600 hover:text-blue-500")
              }
            >
              ⚙️ Configuração (DRE/CTAs)
            </button>
          </div>
        </div>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-100 font-medium">Projetado</span>
                  <TrendingUp size={28} />
                </div>
                <div className="text-3xl font-bold">R$ {formatBRL(totals.projected)}</div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-100 font-medium">Pago</span>
                  <CheckCircle size={28} />
                </div>
                <div className="text-3xl font-bold">R$ {formatBRL(totals.paid)}</div>
              </div>

              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-100 font-medium">A Pagar</span>
                  <Calendar size={28} />
                </div>
                <div className="text-3xl font-bold">R$ {formatBRL(totals.pending)}</div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-100 font-medium">Vencido</span>
                  <AlertCircle size={28} />
                </div>
                <div className="text-3xl font-bold">R$ {formatBRL(totals.overdue)}</div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grupo DRE</label>
                  <select
                    value={filters.groupDre}
                    onChange={(e) => setFilters({ ...filters, groupDre: e.target.value })}
                    className="border rounded-lg px-4 py-2"
                  >
                    <option value="all">Todos</option>
                    {Object.keys(dreConfig).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
                  <input
                    type="text"
                    placeholder="Buscar por descrição ou fornecedor/pessoa..."
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
                  .filter((acc) => getAccountStatus(acc) !== "paid")
                  .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                  .slice(0, 10)
                  .map((acc) => {
                    const st = getAccountStatus(acc);
                    return (
                      <div key={acc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{acc.description}</div>
                          <div className="text-sm text-gray-600">
                            {(acc.groupDre || "-")} • {(acc.subgroup || "-")} • CTA {(acc.cta || "-")}
                          </div>
                        </div>

                        <div className="text-right mr-4">
                          <div className="font-bold text-gray-900">R$ {formatBRL(acc.amount)}</div>
                          <div className="text-sm text-gray-600">{new Date(acc.dueDate).toLocaleDateString("pt-BR")}</div>
                        </div>

                        <div className="flex gap-2 items-center">
                          {st === "overdue" && (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                              Vencido
                            </span>
                          )}
                          {st === "pending" && (
                            <button
                              onClick={() => openPayment(acc)}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 font-medium"
                            >
                              Marcar como Pago
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {getFilteredAccounts().filter((acc) => getAccountStatus(acc) !== "paid").length === 0 && (
                  <div className="text-center text-gray-500 py-8">Nenhuma conta pendente</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* LISTA (INLINE EDIT COM CONFIRMAÇÃO) */}
        {view === "list" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Contas ({getFilteredAccounts().length}) — clique em qualquer célula para editar
            </h2>

            {/* filtros também aqui (usa o mesmo estado do Dashboard) */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
                  <select
                    value={filters.period}
                    onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="today">Hoje</option>
                    <option value="week">Esta Semana</option>
                    <option value="month">Este Mês</option>
                    <option value="all">Todos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grupo DRE</label>
                  <select
                    value={filters.groupDre}
                    onChange={(e) => setFilters({ ...filters, groupDre: e.target.value })}
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="all">Todos</option>
                    {Object.keys(dreConfig).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[220px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                  <input
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder="Descrição ou fornecedor/pessoa..."
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Vencimento</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Descrição</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Grupo DRE</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Subgrupo</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">CTA</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Fornecedor/Pessoa</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Banco</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Obs</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Recorrente</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Valor</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {getFilteredAccounts().map((acc) => {
                    const st = getAccountStatus(acc);
                    const rowGroup = acc.groupDre || acc.group || "";
                    const rowSub = acc.subgroup || acc.subCategory || "";
                    const rowCtas = normalizeCtaList(dreConfig?.[rowGroup]?.[rowSub] || []);
                    const rowSubgroups = Object.keys(dreConfig?.[rowGroup] || {});
                    const subgroupDatalistId = `subgroups-${acc.id}`;
                    const ctasDatalistId = `ctas-${acc.id}`;

                    return (
                      <tr key={acc.id} className="hover:bg-gray-50 align-top">
                        {/* Vencimento */}
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {editingCell?.id === acc.id && editingCell?.field === "dueDate" ? (
                            <input
                              autoFocus
                              type="date"
                              className="border rounded px-2 py-1"
                              defaultValue={acc.dueDate || ""}
                              onBlur={(e) => requestEditConfirm(acc, "dueDate", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                            />
                          ) : (
                            <button
                              className="hover:underline"
                              onClick={() => setEditingCell({ id: acc.id, field: "dueDate" })}
                              title="Clique para editar"
                            >
                              {acc.dueDate ? new Date(acc.dueDate).toLocaleDateString("pt-BR") : "-"}
                            </button>
                          )}
                        </td>

                        {/* Descrição */}
                        <td className="px-4 py-3 text-sm font-medium min-w-[260px]">
                          {editingCell?.id === acc.id && editingCell?.field === "description" ? (
                            <input
                              autoFocus
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={acc.description || ""}
                              onBlur={(e) => requestEditConfirm(acc, "description", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                            />
                          ) : (
                            <button
                              className="text-left w-full hover:underline"
                              onClick={() => setEditingCell({ id: acc.id, field: "description" })}
                              title="Clique para editar"
                            >
                              {acc.description}
                            </button>
                          )}
                        </td>

                        {/* Grupo DRE */}
                        <td className="px-4 py-3 text-sm min-w-[170px]">
                          {editingCell?.id === acc.id && editingCell?.field === "groupDre" ? (
                            <select
                              autoFocus
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={rowGroup || ""}
                              onChange={(e) => requestEditConfirm(acc, "groupDre", e.target.value)}
                              onBlur={() => setEditingCell(null)}
                            >
                              <option value="">(vazio)</option>
                              {Object.keys(dreConfig).map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              className="hover:underline text-left w-full"
                              onClick={() => setEditingCell({ id: acc.id, field: "groupDre" })}
                              title="Clique para editar"
                            >
                              {rowGroup || "-"}
                            </button>
                          )}
                        </td>

                        {/* Subgrupo */}
                        <td className="px-4 py-3 text-sm min-w-[200px]">
                          <datalist id={subgroupDatalistId}>
                            {rowSubgroups.map((sg) => <option key={sg} value={sg} />)}
                          </datalist>

                          {editingCell?.id === acc.id && editingCell?.field === "subgroup" ? (
                            <input
                              autoFocus
                              list={subgroupDatalistId}
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={rowSub || ""}
                              onBlur={(e) => requestEditConfirm(acc, "subgroup", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              placeholder={rowGroup ? "Digite para buscar..." : "Escolha o grupo primeiro"}
                              disabled={!rowGroup}
                            />
                          ) : (
                            <button
                              className="hover:underline text-left w-full"
                              onClick={() => setEditingCell({ id: acc.id, field: "subgroup" })}
                              title="Clique para editar"
                            >
                              {rowSub || "-"}
                            </button>
                          )}
                        </td>

                        {/* CTA */}
                        <td className="px-4 py-3 text-sm min-w-[110px]">
                          <datalist id={ctasDatalistId}>
                            {rowCtas.map((c) => <option key={c} value={c} />)}
                          </datalist>

                          {editingCell?.id === acc.id && editingCell?.field === "cta" ? (
                            <input
                              autoFocus
                              list={ctasDatalistId}
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={String(acc.cta || acc.account || "")}
                              onBlur={(e) => requestEditConfirm(acc, "cta", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              placeholder={rowSub ? "Digite..." : "Escolha o subgrupo"}
                              disabled={!rowSub}
                            />
                          ) : (
                            <button
                              className="hover:underline text-left w-full"
                              onClick={() => setEditingCell({ id: acc.id, field: "cta" })}
                              title="Clique para editar"
                            >
                              {String(acc.cta || acc.account || "") || "-"}
                            </button>
                          )}
                        </td>

                        {/* Fornecedor/Pessoa */}
                        <td className="px-4 py-3 text-sm min-w-[210px]">
                          {editingCell?.id === acc.id && editingCell?.field === "personSupplier" ? (
                            <input
                              autoFocus
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={acc.personSupplier || acc.supplier || ""}
                              onBlur={(e) => requestEditConfirm(acc, "personSupplier", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                            />
                          ) : (
                            <button
                              className="hover:underline text-left w-full"
                              onClick={() => setEditingCell({ id: acc.id, field: "personSupplier" })}
                              title="Clique para editar"
                            >
                              {(acc.personSupplier || acc.supplier || "") || "-"}
                            </button>
                          )}
                        </td>

                        {/* Banco */}
                        <td className="px-4 py-3 text-sm min-w-[140px]">
                          {editingCell?.id === acc.id && editingCell?.field === "bank" ? (
                            <input
                              autoFocus
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={acc.bank || ""}
                              onBlur={(e) => requestEditConfirm(acc, "bank", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              placeholder="Ex: Itaú"
                            />
                          ) : (
                            <button
                              className="hover:underline text-left w-full"
                              onClick={() => setEditingCell({ id: acc.id, field: "bank" })}
                              title="Clique para editar"
                            >
                              {acc.bank || "-"}
                            </button>
                          )}
                        </td>

                        {/* Obs */}
                        <td className="px-4 py-3 text-sm min-w-[240px]">
                          {editingCell?.id === acc.id && editingCell?.field === "obs" ? (
                            <input
                              autoFocus
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={acc.obs || ""}
                              onBlur={(e) => requestEditConfirm(acc, "obs", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              placeholder="Observações..."
                            />
                          ) : (
                            <button
                              className="hover:underline text-left w-full"
                              onClick={() => setEditingCell({ id: acc.id, field: "obs" })}
                              title="Clique para editar"
                            >
                              {acc.obs || "-"}
                            </button>
                          )}
                        </td>

                        {/* Tipo */}
                        <td className="px-4 py-3 text-sm min-w-[120px]">
                          {editingCell?.id === acc.id && editingCell?.field === "expenseType" ? (
                            <select
                              autoFocus
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={acc.expenseType || "fixa"}
                              onChange={(e) => requestEditConfirm(acc, "expenseType", e.target.value)}
                              onBlur={() => setEditingCell(null)}
                            >
                              <option value="fixa">Fixa</option>
                              <option value="variavel">Variável</option>
                            </select>
                          ) : (
                            <button
                              className="hover:underline text-left w-full"
                              onClick={() => setEditingCell({ id: acc.id, field: "expenseType" })}
                              title="Clique para editar"
                            >
                              {(acc.expenseType || "fixa") === "variavel" ? "Variável" : "Fixa"}
                            </button>
                          )}
                        </td>

                        {/* Recorrente */}
                        <td className="px-4 py-3 text-sm min-w-[130px]">
                          {editingCell?.id === acc.id && editingCell?.field === "recurring" ? (
                            <select
                              autoFocus
                              className="border rounded px-2 py-1 w-full"
                              defaultValue={acc.recurring || "nao"}
                              onChange={(e) => requestEditConfirm(acc, "recurring", e.target.value)}
                              onBlur={() => setEditingCell(null)}
                            >
                              <option value="nao">Não</option>
                              <option value="sim">Sim</option>
                            </select>
                          ) : (
                            <button
                              className="hover:underline text-left w-full"
                              onClick={() => setEditingCell({ id: acc.id, field: "recurring" })}
                              title="Clique para editar"
                            >
                              {(acc.recurring || "nao") === "sim" ? "Sim" : "Não"}
                            </button>
                          )}
                        </td>

                        {/* Valor */}
                        <td className="px-4 py-3 text-sm text-right font-medium whitespace-nowrap">
                          {editingCell?.id === acc.id && editingCell?.field === "amount" ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.01"
                              className="border rounded px-2 py-1 w-28 text-right"
                              defaultValue={String(acc.amount ?? "")}
                              onBlur={(e) => requestEditConfirm(acc, "amount", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                            />
                          ) : (
                            <button
                              className="hover:underline"
                              onClick={() => setEditingCell({ id: acc.id, field: "amount" })}
                              title="Clique para editar"
                            >
                              R$ {formatBRL(acc.amount)}
                            </button>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={
                              "px-2 py-1 rounded-full text-xs font-medium " +
                              (st === "paid"
                                ? "bg-green-100 text-green-700"
                                : st === "overdue"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700")
                            }
                          >
                            {st === "paid" ? "Pago" : st === "overdue" ? "Vencido" : "Pendente"}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-2 justify-center">
                            {st !== "paid" && (
                              <button
                                onClick={() => openPayment(acc)}
                                className="text-green-600 hover:text-green-700"
                                title="Marcar como pago"
                              >
                                <CheckCircle size={18} />
                              </button>
                            )}

                            <button
                              onClick={() => openEdit(acc)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Editar no formulário (confirmará ao salvar)"
                            >
                              <Pencil size={18} />
                            </button>

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

                  {getFilteredAccounts().length === 0 && (
                    <tr>
                      <td colSpan={13} className="text-center text-gray-500 py-8">
                        Nenhuma conta encontrada com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Dica: após editar uma célula, o sistema sempre pede confirmação antes de salvar.
            </p>
          </div>
        )}

        {/* RELATÓRIOS */}
        {view === "reports" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Relatórios (DRE / Subgrupo / CTA)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Empresa: <strong>{COMPANY_NAME}</strong> • <strong>{COMPANY_CNPJ}</strong>
            </p>

            {/* MODO */}
            <div className="flex flex-wrap gap-4 items-end mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Modo</label>
                <select
                  value={reportMode}
                  onChange={(e) => setReportMode(e.target.value)}
                  className="border rounded-lg px-4 py-2"
                >
                  <option value="range">Período (datas)</option>
                  <option value="month">Mensal</option>
                  <option value="year">Anual</option>
                </select>
              </div>

              {reportMode === "month" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(parseInt(e.target.value, 10))}
                      className="border rounded-lg px-4 py-2"
                    >
                      {monthNames.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                    <input
                      type="number"
                      value={reportYear}
                      onChange={(e) => setReportYear(parseInt(e.target.value || "0", 10))}
                      className="border rounded-lg px-4 py-2 w-28"
                    />
                  </div>
                </>
              )}

              {reportMode === "year" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                  <input
                    type="number"
                    value={reportYear}
                    onChange={(e) => setReportYear(parseInt(e.target.value || "0", 10))}
                    className="border rounded-lg px-4 py-2 w-28"
                  />
                </div>
              )}

              {reportMode === "range" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data inicial</label>
                    <input
                      type="date"
                      value={reportStart}
                      onChange={(e) => setReportStart(e.target.value)}
                      className="border rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data final</label>
                    <input
                      type="date"
                      value={reportEnd}
                      onChange={(e) => setReportEnd(e.target.value)}
                      className="border rounded-lg px-4 py-2"
                    />
                  </div>
                </>
              )}

              <div className="flex-1" />

              <div className="text-sm text-gray-700 bg-gray-50 border rounded-lg px-4 py-2">
                <div><strong>Projetado:</strong> R$ {formatBRL(reportTotals.projected)}</div>
                <div><strong>Pago:</strong> R$ {formatBRL(reportTotals.paid)}</div>
                <div><strong>A pagar:</strong> R$ {formatBRL(reportTotals.pending + reportTotals.overdue)}</div>
              </div>
            </div>

            {/* FILTROS */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Grupo DRE</label>
                <select
                  value={reportGroup}
                  onChange={(e) => { setReportGroup(e.target.value); setReportSubgroup("all"); setReportCta("all"); }}
                  className="border rounded-lg px-4 py-2 w-full"
                >
                  <option value="all">Todos</option>
                  {reportGroupsAvailable.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Subgrupo</label>
                <select
                  value={reportSubgroup}
                  onChange={(e) => { setReportSubgroup(e.target.value); setReportCta("all"); }}
                  className="border rounded-lg px-4 py-2 w-full"
                  disabled={reportGroup === "all"}
                >
                  <option value="all">Todos</option>
                  {reportSubgroupsAvailable.map((sg) => (
                    <option key={sg} value={sg}>{sg}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">CTA</label>
                <select
                  value={reportCta}
                  onChange={(e) => setReportCta(e.target.value)}
                  className="border rounded-lg px-4 py-2 w-full"
                  disabled={reportGroup === "all" || reportSubgroup === "all"}
                >
                  <option value="all">Todos</option>
                  {reportCtasAvailable.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={reportStatus}
                  onChange={(e) => setReportStatus(e.target.value)}
                  className="border rounded-lg px-4 py-2 w-full"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="overdue">Vencido</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <select
                  value={reportExpenseType}
                  onChange={(e) => setReportExpenseType(e.target.value)}
                  className="border rounded-lg px-4 py-2 w-full"
                >
                  <option value="all">Todos</option>
                  <option value="fixa">Fixa</option>
                  <option value="variavel">Variável</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recorrente</label>
                <select
                  value={reportRecurring}
                  onChange={(e) => setReportRecurring(e.target.value)}
                  className="border rounded-lg px-4 py-2 w-full"
                >
                  <option value="all">Todos</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </div>

            {/* AÇÕES */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={exportReportCurrent}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm shadow-md transition"
              >
                📤 Exportar Relatório (Excel)
              </button>

              <button
                onClick={generateNextMonthRecurring}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm shadow-md transition flex items-center gap-2"
                title="Gera as contas recorrentes para o próximo mês"
              >
                <RefreshCw size={16} /> Gerar Próximo Mês (Recorrentes)
              </button>
            </div>

            {/* RESULTADO */}
            <div className="space-y-4">
              {reportRows.length === 0 && (
                <div className="text-center text-gray-500 py-8">Nenhuma conta no filtro selecionado.</div>
              )}

              {Object.entries(reportByGroupSubgroupCta).map(([g, subMap]) => {
                let gTotals = { projected: 0, paid: 0, pending: 0, overdue: 0 };
                Object.values(subMap).forEach((ctaMap) => {
                  Object.values(ctaMap).forEach((d) => {
                    gTotals.projected += d.projected;
                    gTotals.paid += d.paid;
                    gTotals.pending += d.pending;
                    gTotals.overdue += d.overdue;
                  });
                });

                const pct = gTotals.projected > 0 ? (gTotals.paid / gTotals.projected) * 100 : 0;

                return (
                  <div key={g} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg">{g}</h3>
                      <div className="text-sm text-gray-600">
                        Realizado: <strong>{pct.toFixed(1)}%</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <div><div className="text-sm text-gray-600">Projetado</div><div className="text-lg font-bold">R$ {formatBRL(gTotals.projected)}</div></div>
                      <div><div className="text-sm text-gray-600">Pago</div><div className="text-lg font-bold text-green-600">R$ {formatBRL(gTotals.paid)}</div></div>
                      <div><div className="text-sm text-gray-600">Pendente</div><div className="text-lg font-bold text-yellow-600">R$ {formatBRL(gTotals.pending)}</div></div>
                      <div><div className="text-sm text-gray-600">Vencido</div><div className="text-lg font-bold text-red-600">R$ {formatBRL(gTotals.overdue)}</div></div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: pct + "%" }} />
                    </div>

                    <div className="space-y-4">
                      {Object.entries(subMap).map(([sg, ctaMap]) => (
                        <div key={sg} className="border rounded-lg p-3 bg-gray-50">
                          <div className="font-semibold mb-2">{sg}</div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm bg-white rounded-lg">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left">CTA</th>
                                  <th className="px-3 py-2 text-right">Projetado</th>
                                  <th className="px-3 py-2 text-right">Pago</th>
                                  <th className="px-3 py-2 text-right">Pendente</th>
                                  <th className="px-3 py-2 text-right">Vencido</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {Object.entries(ctaMap).map(([cta, d]) => (
                                  <tr key={cta}>
                                    <td className="px-3 py-2">{cta}</td>
                                    <td className="px-3 py-2 text-right">R$ {formatBRL(d.projected)}</td>
                                    <td className="px-3 py-2 text-right text-green-700">R$ {formatBRL(d.paid)}</td>
                                    <td className="px-3 py-2 text-right text-yellow-700">R$ {formatBRL(d.pending)}</td>
                                    <td className="px-3 py-2 text-right text-red-700">R$ {formatBRL(d.overdue)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {view === "settings" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Settings /> Configuração do DRE (Grupos / Subgrupos / CTAs)
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Tudo que você alterar aqui pede confirmação e fica salvo neste navegador.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={exportDreConfig}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm shadow-md transition"
              >
                <Download size={18} /> Exportar DRE (JSON)
              </button>

              <label className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 cursor-pointer text-sm shadow-md transition">
                <Upload size={18} /> Importar DRE (JSON)
                <input type="file" accept=".json" onChange={importDreConfig} className="hidden" />
              </label>
            </div>

            {/* Criar Grupo */}
            <div className="border rounded-lg p-4 mb-6">
              <div className="font-semibold mb-3">1) Criar novo Grupo DRE</div>
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="border rounded-lg px-4 py-2 flex-1"
                  placeholder="Ex: RECEITAS, INVESTIMENTOS..."
                />
                <button
                  onClick={addGroup}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + Criar Grupo
                </button>
              </div>
            </div>

            {/* Seleção */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grupo DRE</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => { setSelectedGroup(e.target.value); setSelectedSubgroup(""); }}
                  className="border rounded-lg px-4 py-2 w-full"
                >
                  <option value="">Selecione...</option>
                  {settingsGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subgrupo</label>
                <select
                  value={selectedSubgroup}
                  onChange={(e) => setSelectedSubgroup(e.target.value)}
                  className="border rounded-lg px-4 py-2 w-full"
                  disabled={!selectedGroup}
                >
                  <option value="">Selecione...</option>
                  {settingsSubgroups.map((sg) => (
                    <option key={sg} value={sg}>{sg}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                {selectedGroup && (
                  <>
                    <button
                      onClick={() => renameGroup(selectedGroup)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Renomear Grupo
                    </button>
                    <button
                      onClick={() => deleteGroup(selectedGroup)}
                      className="px-4 py-2 border rounded-lg text-red-600 hover:bg-red-50"
                    >
                      Excluir Grupo
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Criar Subgrupo */}
            <div className="border rounded-lg p-4 mb-6">
              <div className="font-semibold mb-3">2) Criar Subgrupo (dentro do Grupo selecionado)</div>
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  value={newSubgroupName}
                  onChange={(e) => setNewSubgroupName(e.target.value)}
                  className="border rounded-lg px-4 py-2 flex-1"
                  placeholder="Ex: Água, Luz, Material Didático..."
                  disabled={!selectedGroup}
                />
                <button
                  onClick={addSubgroup}
                  disabled={!selectedGroup}
                  className={"px-4 py-2 rounded-lg " + (selectedGroup ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-500")}
                >
                  + Criar Subgrupo
                </button>
                {selectedGroup && selectedSubgroup && (
                  <>
                    <button
                      onClick={() => renameSubgroup(selectedSubgroup)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Renomear Subgrupo
                    </button>
                    <button
                      onClick={() => deleteSubgroup(selectedSubgroup)}
                      className="px-4 py-2 border rounded-lg text-red-600 hover:bg-red-50"
                    >
                      Excluir Subgrupo
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Criar CTA */}
            <div className="border rounded-lg p-4 mb-6">
              <div className="font-semibold mb-3">3) CTAs do Subgrupo selecionado</div>

              <div className="flex flex-col md:flex-row gap-2 mb-3">
                <input
                  value={newCtaValue}
                  onChange={(e) => setNewCtaValue(e.target.value)}
                  className="border rounded-lg px-4 py-2 flex-1"
                  placeholder="Ex: 370"
                  disabled={!selectedGroup || !selectedSubgroup}
                />
                <button
                  onClick={addCta}
                  disabled={!selectedGroup || !selectedSubgroup}
                  className={"px-4 py-2 rounded-lg " + (selectedGroup && selectedSubgroup ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-200 text-gray-500")}
                >
                  + Adicionar CTA
                </button>
              </div>

              {(!selectedGroup || !selectedSubgroup) && (
                <div className="text-sm text-gray-500">
                  Selecione um Grupo e um Subgrupo para editar CTAs.
                </div>
              )}

              {selectedGroup && selectedSubgroup && (
                <div className="flex flex-wrap gap-2">
                  {settingsCtas.length === 0 && (
                    <div className="text-sm text-gray-500">Nenhum CTA cadastrado.</div>
                  )}
                  {settingsCtas.map((cta) => (
                    <span key={cta} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
                      <span className="text-sm">{cta}</span>
                      <button
                        onClick={() => removeCta(cta)}
                        className="text-red-600 hover:text-red-700"
                        title="Remover CTA"
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FORM MODAL */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingId ? "Editar Conta (confirmará ao salvar)" : "Nova Conta a Pagar"}
                </h2>
                <button onClick={closeForm} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <datalist id="dre-groups">
                {groupsList.map((g) => <option key={g} value={g} />)}
              </datalist>
              <datalist id="dre-subgroups">
                {subgroupsList.map((sg) => <option key={sg} value={sg} />)}
              </datalist>
              <datalist id="dre-ctas">
                {ctasList.map((c) => <option key={c} value={c} />)}
              </datalist>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: Aluguel, Salário, DAS..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grupo DRE *</label>
                  <input
                    list="dre-groups"
                    value={formData.groupDre}
                    onChange={(e) => setFormData({ ...formData, groupDre: e.target.value, subgroup: "", cta: "" })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Digite para buscar..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subgrupo *</label>
                  <input
                    list="dre-subgroups"
                    value={formData.subgroup}
                    onChange={(e) => setFormData({ ...formData, subgroup: e.target.value, cta: "" })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder={formData.groupDre ? "Digite para buscar..." : "Escolha o Grupo primeiro"}
                    disabled={!formData.groupDre}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CTA</label>
                  <input
                    list="dre-ctas"
                    value={formData.cta}
                    onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder={formData.subgroup ? "Digite para buscar..." : "Escolha o Subgrupo primeiro"}
                    disabled={!formData.subgroup}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pessoa / Fornecedor</label>
                  <input
                    type="text"
                    value={formData.personSupplier}
                    onChange={(e) => setFormData({ ...formData, personSupplier: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: Fernanda, Fornecedor X..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vencimento *</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor *</label>
                  <input
                    type="text"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: 1.234,56"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de despesa</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recorrente</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banco</label>
                  <input
                    type="text"
                    value={formData.bank}
                    onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: Itaú, Inter"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Forma de pagamento</label>
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={formData.obs}
                    onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
                    rows={3}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Informações adicionais..."
                  />
                </div>
              </div>

              <div className="flex gap-4 justify-end">
                <button onClick={closeForm} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 font-medium shadow-md"
                >
                  ✓ {editingId ? "Salvar Alterações" : "Adicionar Conta"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT MODAL */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Confirmar Pagamento</h2>
                <button onClick={closePayment} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data do pagamento *</label>
                  <input
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banco</label>
                  <input
                    type="text"
                    value={paymentData.bank}
                    onChange={(e) => setPaymentData({ ...paymentData, bank: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: Itaú, Inter"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Forma de pagamento</label>
                  <select
                    value={paymentData.paymentMethod}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observação do pagamento</label>
                  <textarea
                    rows={3}
                    value={paymentData.paymentObs}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentObs: e.target.value })}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Ex: pago via PIX do caixa / desconto / juros..."
                  />
                </div>
              </div>

              <div className="flex gap-4 justify-end">
                <button onClick={closePayment} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={confirmPayment}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md"
                >
                  ✓ Confirmar Pagamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CONFIRMAÇÃO INLINE EDIT */}
        {showConfirmEdit && pendingEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar alteração</h3>
              <p className="text-sm text-gray-700 mb-4">
                Campo: <strong>{fieldLabels[pendingEdit.field] || pendingEdit.field}</strong>
              </p>

              <div className="border rounded-lg p-3 bg-gray-50 text-sm mb-4">
                <div className="mb-1"><strong>Antes:</strong> {String(pendingEdit.oldValue ?? "")}</div>
                <div><strong>Depois:</strong> {String(pendingEdit.newValue ?? "")}</div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelPendingEdit}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={applyPendingEdit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md"
                >
                  Confirmar e salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="mt-8 text-center text-gray-500 text-sm pb-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="font-medium text-blue-600">© {new Date().getFullYear()} Colégio Querubin's</p>
            <p className="text-xs mt-1">{COMPANY_NAME} • {COMPANY_CNPJ}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}


