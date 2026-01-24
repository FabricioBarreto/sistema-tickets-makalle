"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings as SettingsIcon,
  DollarSign,
  Calendar,
  Mail,
  CreditCard,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";

type ConfigState = {
  ticketPrice: number;
  totalAvailable: number;
  maxPerPurchase: number;
  salesEnabled: boolean;

  eventName: string;
  eventDate: string; // datetime-local
  eventLocation: string;

  emailFrom: string;
  emailEnabled: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO -> datetime-local (sin segundos) */
const toDatetimeLocal = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

/** datetime-local -> ISO */
const fromDatetimeLocalToIso = (dtLocal: string) => {
  if (!dtLocal) return "";
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cfg, setCfg] = useState<ConfigState>({
    ticketPrice: 0,
    totalAvailable: 0,
    maxPerPurchase: 10,
    salesEnabled: true,

    eventName: "",
    eventDate: "",
    eventLocation: "",

    emailFrom: "",
    emailEnabled: true,
  });

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error || text || "No se pudo cargar la configuración",
        );
      }

      const c = data.data;

      setCfg({
        ticketPrice: Number(c.ticketPrice ?? 0),
        totalAvailable: Number(c.totalAvailable ?? 0),
        maxPerPurchase: Number(c.maxPerPurchase ?? 10),
        salesEnabled: Boolean(c.salesEnabled ?? true),

        eventName: c.eventName ?? "",
        eventDate: c.eventDate ? toDatetimeLocal(c.eventDate) : "",
        eventLocation: c.eventLocation ?? "",

        emailFrom: c.emailFrom ?? "",
        emailEnabled: Boolean(c.emailEnabled ?? true),
      });
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof Error) {
        toast.error(e.message || "Error cargando configuración");
      } else {
        toast.error("Error cargando configuración");
      }
    } finally {
      setLoading(false);
    }
  };

  const putConfig = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || text || "No se pudo guardar");
      }

      toast.success("Guardado ✅");
      await loadConfig();
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof Error) {
        toast.error(e.message || "Error guardando");
      } else {
        toast.error("Error guardando");
      }
    } finally {
      setSaving(false);
    }
  };

  const validations = useMemo(() => {
    const errors: string[] = [];

    if (cfg.ticketPrice < 0) errors.push("El precio no puede ser negativo.");
    if (cfg.totalAvailable < 0)
      errors.push("El total disponible no puede ser negativo.");
    if (cfg.maxPerPurchase <= 0)
      errors.push("El máximo por compra debe ser mayor a 0.");
    if (cfg.maxPerPurchase > 1000)
      errors.push("El máximo por compra es ridículamente alto (¿seguro?).");

    if (cfg.emailEnabled) {
      if (!cfg.emailFrom.trim())
        errors.push("Si el email está habilitado, completá Email From.");
      if (cfg.emailFrom && !/^\S+@\S+\.\S+$/.test(cfg.emailFrom))
        errors.push("Email From no parece un email válido.");
    }

    return errors;
  }, [cfg]);

  const canSave = validations.length === 0 && !saving;

  if (loading) {
    return (
      <div className="text-sm text-gray-600">Cargando configuración...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Configuración
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Ajusta la configuración del sistema
        </p>
      </div>

      {validations.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
          <div className="font-semibold mb-2">Antes de guardar:</div>
          <ul className="list-disc pl-5 space-y-1">
            {validations.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuración de Entradas */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-purple-100 rounded-lg p-2">
              <SettingsIcon className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold">Configuración de Entradas</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="ticketPrice">Precio de Entrada</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="ticketPrice"
                  type="number"
                  value={cfg.ticketPrice}
                  onChange={(e) =>
                    setCfg((p) => ({
                      ...p,
                      ticketPrice: Number(e.target.value),
                    }))
                  }
                  className="pl-10"
                  min={0}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="totalAvailable">Total Disponible</Label>
              <Input
                id="totalAvailable"
                type="number"
                value={cfg.totalAvailable}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    totalAvailable: Number(e.target.value),
                  }))
                }
                className="mt-1"
                min={0}
              />
            </div>

            <div>
              <Label htmlFor="maxPerPurchase">Máximo por Compra</Label>
              <Input
                id="maxPerPurchase"
                type="number"
                value={cfg.maxPerPurchase}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    maxPerPurchase: Number(e.target.value),
                  }))
                }
                className="mt-1"
                min={1}
              />
            </div>

            <Button
              disabled={!canSave}
              onClick={() =>
                putConfig({
                  ticketPrice: cfg.ticketPrice,
                  totalAvailable: cfg.totalAvailable,
                  maxPerPurchase: cfg.maxPerPurchase,
                })
              }
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </Card>

        {/* Configuración del Evento */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 rounded-lg p-2">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold">Configuración del Evento</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="eventName">Nombre del Evento</Label>
              <Input
                id="eventName"
                value={cfg.eventName}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, eventName: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="eventDate">Fecha del Evento</Label>
              <Input
                id="eventDate"
                type="datetime-local"
                value={cfg.eventDate}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, eventDate: e.target.value }))
                }
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                La fecha se almacena en formato ISO para garantizar consistencia
                horaria.
              </p>
            </div>

            <div>
              <Label htmlFor="eventLocation">Ubicación</Label>
              <Input
                id="eventLocation"
                value={cfg.eventLocation}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, eventLocation: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            <Button
              disabled={!canSave}
              onClick={() =>
                putConfig({
                  eventName: cfg.eventName,
                  eventDate: cfg.eventDate
                    ? fromDatetimeLocalToIso(cfg.eventDate)
                    : "",
                  eventLocation: cfg.eventLocation,
                })
              }
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </Card>

        {/* Email */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-rose-100 rounded-lg p-2">
              <Mail className="h-5 w-5 text-rose-600" />
            </div>
            <h2 className="text-lg font-semibold">Email</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">Emails habilitados</div>
                <p className="text-xs text-gray-600">
                  Si está apagado, no se envía nada (ni confirmaciones, ni
                  nada).
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCfg((p) => ({ ...p, emailEnabled: !p.emailEnabled }))
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
              >
                {cfg.emailEnabled ? (
                  <>
                    <ToggleRight className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm">ON</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-5 w-5 text-gray-400" />
                    <span className="text-sm">OFF</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <Label htmlFor="emailFrom">Email From</Label>
              <Input
                id="emailFrom"
                value={cfg.emailFrom}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, emailFrom: e.target.value }))
                }
                className="mt-1"
                placeholder="noreply@tu-dominio.com"
                disabled={!cfg.emailEnabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                Debe coincidir con un remitente autorizado por su proveedor de
                correo.
              </p>
            </div>

            <Button
              disabled={!canSave}
              onClick={() =>
                putConfig({
                  emailEnabled: cfg.emailEnabled,
                  emailFrom: cfg.emailFrom,
                })
              }
              className="w-full bg-rose-600 hover:bg-rose-700"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </Card>

        {/* Ventas */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-slate-100 rounded-lg p-2">
              <SettingsIcon className="h-5 w-5 text-slate-700" />
            </div>
            <h2 className="text-lg font-semibold">Estado de Ventas</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-medium">
                {cfg.salesEnabled ? "Ventas activas" : "Ventas pausadas"}
              </div>
              <p className="text-sm text-gray-600">
                Cuando las ventas están pausadas, el público no podrá realizar
                compras, pero el panel administrativo seguirá disponible.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setCfg((p) => ({ ...p, salesEnabled: !p.salesEnabled }))
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
              >
                {cfg.salesEnabled ? (
                  <>
                    <ToggleRight className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm">ON</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-5 w-5 text-gray-400" />
                    <span className="text-sm">OFF</span>
                  </>
                )}
              </button>

              <Button
                disabled={!canSave}
                onClick={() => putConfig({ salesEnabled: cfg.salesEnabled })}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
