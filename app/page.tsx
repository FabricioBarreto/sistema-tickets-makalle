"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  MapPin,
  Clock,
  Ticket,
  CheckCircle2,
  Shield,
  Users,
  Sparkles,
  Heart,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Image from "next/image";

interface EventDate {
  id: string;
  date: string;
  name: string;
}

interface SystemConfig {
  ticketPrice: number;
  totalAvailable: number;
  maxPerPurchase: number;
  salesEnabled: boolean;
  eventDates: string | EventDate[]; // puede venir como string o array
  eventName: string;
  eventLocation: string;
}

export default function LandingPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [soldCount, setSoldCount] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const cfgRes = await fetch("/api/config", { cache: "no-store" });
      const cfgData = await cfgRes.json();

      if (cfgRes.ok && cfgData?.success) {
        setConfig(cfgData.data);

        // Parse event dates
        let dates: EventDate[] = [];
        try {
          if (typeof cfgData.data.eventDates === "string") {
            dates = JSON.parse(cfgData.data.eventDates);
          } else if (Array.isArray(cfgData.data.eventDates)) {
            dates = cfgData.data.eventDates;
          }
        } catch (e) {
          console.error("Error parsing eventDates:", e);
        }
        setEventDates(dates);
        setLoading(false);

        fetchStats();
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsRes = await fetch("/api/stats", { cache: "no-store" });
      const statsData = await statsRes.json();

      if (statsRes.ok && statsData?.success) {
        setSoldCount(statsData.data?.soldCount || 0);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      setSoldCount(0);
    }
  };

  const handleBuyTickets = () => {
    router.push(`/checkout?quantity=${quantity}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500">
        <div className="text-center">
          <div className="text-white text-4xl sm:text-6xl mb-4 animate-bounce">
            🎭
          </div>
          <div className="text-white text-xl sm:text-2xl font-bold animate-pulse px-4">
            Cargando...
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl text-center max-w-md w-full">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-xl sm:text-2xl font-bold mb-2 text-gray-900">
            Sin configuración
          </div>
          <div className="text-sm sm:text-base text-gray-600 mb-6">
            Cargá la configuración desde el panel admin para habilitar ventas.
          </div>
          <button
            onClick={() => router.push("/admin/login")}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold py-3 rounded-xl hover:shadow-lg transition-all"
          >
            Ir a Administración
          </button>
        </div>
      </div>
    );
  }

  const available = (config.totalAvailable || 0) - soldCount;
  const totalPrice = (config.ticketPrice || 0) * quantity;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 overflow-hidden">
      {/* Animated background elements - Hidden on mobile */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden sm:block">
        <div className="absolute top-20 left-10 text-4xl sm:text-6xl animate-bounce opacity-20">
          🎭
        </div>
        <div className="absolute top-40 right-20 text-4xl sm:text-6xl animate-pulse opacity-20">
          🎉
        </div>
        <div
          className="absolute bottom-20 left-1/4 text-4xl sm:text-6xl animate-bounce opacity-20"
          style={{ animationDelay: "1s" }}
        >
          🎊
        </div>
        <div
          className="absolute bottom-40 right-1/3 text-4xl sm:text-6xl animate-pulse opacity-20"
          style={{ animationDelay: "0.5s" }}
        >
          ✨
        </div>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-2xl sm:text-4xl">🎭</div>
              <div>
                <div className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-orange-600 font-black text-sm sm:text-xl">
                  Carnaval Makallé
                </div>
                <div className="text-[10px] sm:text-xs text-gray-600 font-semibold">
                  Municipio de Makallé
                </div>
              </div>
            </div>
            <button
              onClick={() =>
                window.scrollTo({
                  top: document.getElementById("comprar")?.offsetTop,
                  behavior: "smooth",
                })
              }
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 px-4 sm:px-8 py-2 sm:py-3 rounded-full font-black text-sm sm:text-lg hover:shadow-2xl hover:scale-110 transition-all animate-pulse shadow-lg border-2 border-white"
            >
              <span className="hidden sm:inline">¡Comprar ahora! 🎟️</span>
              <span className="sm:hidden">Comprar 🎟️</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Image */}
      <div className="pt-16 sm:pt-24 pb-6 sm:pb-8 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          {/* Main Banner Image */}
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl mb-6 sm:mb-8 max-w-5xl mx-auto">
            <Image
              src="/img/portada.png"
              alt="Carnaval Makallé"
              width={1200}
              height={600}
              className="w-full h-auto"
              priority
              quality={85}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
          </div>

          {/* Event Dates - Multiple dates display */}
          {eventDates.length > 0 && (
            <div className="mb-6 sm:mb-8 max-w-5xl mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-4 drop-shadow-lg">
                📅 Fechas del Evento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {eventDates.map((eventDate, idx) => {
                  const date = new Date(eventDate.date);
                  return (
                    <div
                      key={eventDate.id}
                      className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500 font-semibold uppercase">
                            {eventDate.name}
                          </div>
                          <div className="font-bold text-gray-900 text-sm sm:text-base truncate">
                            {date.toLocaleDateString("es-AR", {
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        {date.toLocaleDateString("es-AR", { weekday: "long" })}{" "}
                        • 21:00 hs
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Event Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-12 max-w-5xl mx-auto">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-semibold uppercase">
                    Lugar
                  </div>
                  <div className="font-bold text-gray-900 text-sm sm:text-base">
                    Makallé
                  </div>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 truncate">
                {config.eventLocation}
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-semibold uppercase">
                    Horario
                  </div>
                  <div className="font-bold text-gray-900 text-sm sm:text-base">
                    21:00 hs
                  </div>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-600">
                Apertura de puertas
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-semibold uppercase">
                    Disponibles
                  </div>
                  <div className="font-bold text-gray-900 text-sm sm:text-base">
                    {available > 0 ? `${available} entradas` : "Agotadas"}
                  </div>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-600">
                {available > 0 ? "¡Comprá ahora!" : "Sin stock"}
              </div>
            </div>
          </div>

          {/* Availability Badge */}
          <div className="text-center mb-6 sm:mb-8">
            {available > 0 ? (
              <div className="inline-flex items-center gap-2 bg-green-500 text-white px-4 sm:px-8 py-2 sm:py-3 rounded-full font-bold text-sm sm:text-lg shadow-lg animate-pulse">
                <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6" />
                <span className="hidden sm:inline">
                  ¡{available} entradas disponibles!
                </span>
                <span className="sm:hidden">{available} disponibles</span>
              </div>
            ) : soldCount > 0 ? (
              <div className="inline-flex items-center gap-2 bg-red-500 text-white px-4 sm:px-8 py-2 sm:py-3 rounded-full font-bold text-sm sm:text-lg shadow-lg">
                ⚠️ <span className="hidden sm:inline">Entradas agotadas</span>
                <span className="sm:hidden">Agotadas</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 sm:px-8 py-2 sm:py-3 rounded-full font-bold text-sm sm:text-lg shadow-lg animate-pulse">
                <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6" />
                ¡Entradas disponibles!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Purchase Section */}
      <div id="comprar" className="pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-2 sm:mb-3 drop-shadow-lg px-4">
              ¡Conseguí tus entradas! 🎟️
            </h2>
            <p className="text-base sm:text-xl text-white/90 drop-shadow px-4">
              No te quedes afuera de la fiesta más grande del año
            </p>
          </div>

          {/* Main Ticket Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transform hover:scale-[1.01] sm:hover:scale-[1.02] transition-all">
            {/* Decorative Header */}
            <div className="bg-gradient-to-r from-pink-600 via-red-500 to-orange-500 p-6 sm:p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 hidden sm:block">
                <div className="absolute top-0 left-0 text-9xl">🎭</div>
                <div className="absolute bottom-0 right-0 text-9xl">🎉</div>
              </div>
              <div className="relative z-10">
                <div className="text-white/90 text-xs sm:text-sm font-bold uppercase tracking-widest mb-2 sm:mb-3 flex items-center justify-center gap-2">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  Entrada General
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <div className="text-white text-5xl sm:text-6xl md:text-7xl font-black mb-2 sm:mb-3 drop-shadow-lg">
                  {formatCurrency(config.ticketPrice || 0)}
                </div>
                <div className="text-white/95 text-sm sm:text-base md:text-lg font-medium px-4">
                  Por persona • Acceso completo al evento
                </div>
              </div>
            </div>

            {/* Ticket Content */}
            <div className="p-4 sm:p-6 md:p-8">
              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="flex items-start gap-3 sm:gap-4 bg-gradient-to-br from-pink-50 to-orange-50 p-3 sm:p-4 rounded-xl">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 mb-1 text-sm sm:text-base">
                      Entrada Digital
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                      QR code al instante por email
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 bg-gradient-to-br from-green-50 to-emerald-50 p-3 sm:p-4 rounded-xl">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 mb-1 text-sm sm:text-base">
                      Pago Seguro
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                      Procesado por Mercado Pago
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 bg-gradient-to-br from-blue-50 to-cyan-50 p-3 sm:p-4 rounded-xl">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 mb-1 text-sm sm:text-base">
                      Confirmación Inmediata
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                      Recibí tu entrada al instante
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:gap-4 bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-4 rounded-xl">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 mb-1 text-sm sm:text-base">
                      Compra Grupal
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                      Hasta {config.maxPerPurchase} entradas
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm sm:text-base font-bold text-gray-700 mb-3 sm:mb-4 text-center">
                  ¿Cuántas entradas necesitás?
                </label>
                <div className="flex items-center gap-3 sm:gap-4 max-w-md mx-auto">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 text-white flex items-center justify-center font-bold text-xl sm:text-2xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    −
                  </button>

                  <div className="flex-1 text-center bg-gradient-to-br from-pink-50 to-orange-50 rounded-xl py-3 sm:py-4">
                    <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-orange-600">
                      {quantity}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 font-semibold mt-1">
                      {quantity === 1 ? "entrada" : "entradas"}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setQuantity(
                        Math.min(config.maxPerPurchase || 10, quantity + 1),
                      )
                    }
                    disabled={quantity >= (config.maxPerPurchase || 10)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 text-white flex items-center justify-center font-bold text-xl sm:text-2xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    +
                  </button>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2 sm:mt-3 font-medium">
                  Máximo {config.maxPerPurchase} entradas por compra
                </div>
              </div>

              {/* Total Price */}
              <div className="bg-gradient-to-r from-pink-100 via-red-100 to-orange-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-700 font-bold text-base sm:text-lg">
                    Total a pagar:
                  </div>
                  <div className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-orange-600">
                    {formatCurrency(totalPrice)}
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-gray-600 text-right font-medium">
                  {quantity} {quantity === 1 ? "entrada" : "entradas"} ×{" "}
                  {formatCurrency(config.ticketPrice || 0)}
                </div>
              </div>

              {/* Buy Button */}
              <button
                onClick={handleBuyTickets}
                disabled={!config.salesEnabled || available <= 0}
                className="w-full bg-gradient-to-r from-pink-600 via-red-500 to-orange-500 hover:from-pink-700 hover:via-red-600 hover:to-orange-600 text-white font-black py-4 sm:py-5 px-6 sm:px-8 rounded-xl sm:rounded-2xl text-base sm:text-xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 sm:gap-3"
              >
                {!config.salesEnabled ? (
                  "Ventas cerradas"
                ) : available <= 0 && soldCount > 0 ? (
                  "Entradas agotadas"
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="hidden sm:inline">
                      ¡Comprar Entradas Ahora!
                    </span>
                    <span className="sm:hidden">¡Comprar Ahora!</span>
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                  </>
                )}
              </button>

              <div className="text-center mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600 flex items-center justify-center gap-2">
                <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                <span className="font-medium">
                  Pago 100% seguro con Mercado Pago
                </span>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-12 sm:mt-16 text-center">
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-6 sm:mb-8 drop-shadow-lg px-4">
              ¿Cómo funciona? Es muy fácil! 🎯
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
                <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">1️⃣</div>
                <div className="font-bold text-lg sm:text-xl mb-2 sm:mb-3 text-gray-900">
                  Elegí tu cantidad
                </div>
                <div className="text-sm sm:text-base text-gray-600">
                  Seleccioná cuántas entradas necesitás para vos y tus amigos
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
                <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">2️⃣</div>
                <div className="font-bold text-lg sm:text-xl mb-2 sm:mb-3 text-gray-900">
                  Pagá seguro
                </div>
                <div className="text-sm sm:text-base text-gray-600">
                  Con Mercado Pago
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
                <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">3️⃣</div>
                <div className="font-bold text-lg sm:text-xl mb-2 sm:mb-3 text-gray-900">
                  Recibí tu QR
                </div>
                <div className="text-sm sm:text-base text-gray-600">
                  Al instante, listo para presentar en la entrada
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-pink-900 via-red-900 to-orange-900 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          {" "}
          <p className="text-white/70 text-xs sm:text-sm px-4">
            © 2026 Carnavales Makallé - Municipio de Makallé - Todos los
            derechos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
