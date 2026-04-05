"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Settings,
  User,
  Send,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// ── Supabase client (browser-safe public keys) ────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Patient {
  phone_number: string;
  name: string;
}
interface Message {
  id: number;
  phone_number: string;
  direction: "inbound" | "outbound";
  content: string;
  created_at: string;
}
interface Appointment {
  id: number;
  phone_number: string;
  patient_name: string;
  dental_problem: string;
  preferred_time: string;
  status: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}
function isToday(iso: string) {
  const d = new Date(iso), now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [aiPaused, setAiPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [{ data: p }, { data: m }, { data: a }] = await Promise.all([
        supabase.from("patients").select("*").order("name"),
        supabase.from("messages").select("*").order("created_at"),
        supabase.from("appointments").select("*").order("created_at", { ascending: false }),
      ]);
      if (p) setPatients(p);
      if (m) setMessages(m);
      if (a) setAppointments(a);
      setLoading(false);
    }
    fetchAll();
  }, []);

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("realtime:dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        (payload) => setAppointments((prev) => [payload.new as Appointment, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "patients" },
        (payload) => setPatients((prev) => [...prev, payload.new as Patient])
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Auto-scroll to latest message ────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedPhone]);

  // ── Derived values ────────────────────────────────────────────────────────
  const todayMessages = messages.filter((m) => isToday(m.created_at));
  const totalAppointments = appointments.length;

  function latestMessage(phone: string) {
    const msgs = messages.filter((m) => m.phone_number === phone);
    return msgs[msgs.length - 1];
  }

  const activeMessages = selectedPhone
    ? messages.filter((m) => m.phone_number === selectedPhone)
    : [];
  const selectedPatient = patients.find((p) => p.phone_number === selectedPhone);

  const navItems = [
    { id: "overview",       label: "Overview",       icon: <LayoutDashboard size={20} /> },
    { id: "conversations",  label: "Conversations",  icon: <MessageSquare size={20} /> },
    { id: "appointments",   label: "Appointments",   icon: <Calendar size={20} /> },
    { id: "settings",       label: "Settings",       icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen w-full bg-white text-slate-900 font-sans">

      {/* ── Sidebar ── */}
      <aside className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 text-2xl">🦷</span> DentalFront
          </h1>
          <p className="text-xs text-slate-500 mt-1">AI Receptionist MVP</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">Dr</div>
            <div>
              <p className="font-medium text-slate-900">Dr. Admin</p>
              <p className="text-slate-500 text-xs">ABC Dental Clinic</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shadow-sm z-10">
          <h2 className="text-lg font-semibold capitalize text-slate-800">{activeTab}</h2>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Syncing…
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto">

          {/* ────────────── OVERVIEW ────────────── */}
          {activeTab === "overview" && (
            <div className="p-8 space-y-6 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">WhatsApp Messages</CardTitle>
                    <MessageSquare size={16} className="text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">{loading ? "—" : todayMessages.length}</div>
                    <p className="text-xs text-slate-500 mt-1">Today</p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Appointments Booked</CardTitle>
                    <Calendar size={16} className="text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{loading ? "—" : totalAppointments}</div>
                    <p className="text-xs text-slate-500 mt-1">Fully handled by AI</p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Missed Chats</CardTitle>
                    <User size={16} className="text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">0</div>
                    <p className="text-xs text-slate-500 mt-1">Requiring manual intervention</p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Upcoming Today</CardTitle>
                    <Calendar size={16} className="text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">{loading ? "—" : totalAppointments}</div>
                    <p className="text-xs text-slate-500 mt-1">Total appointments</p>
                  </CardContent>
                </Card>

              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Recent Messages feed */}
                <Card className="shadow-sm border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-700">Recent Messages</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                    {messages.length === 0 && !loading && (
                      <p className="text-slate-400 text-xs">No messages yet.</p>
                    )}
                    {[...messages].reverse().slice(0, 6).map((msg) => (
                      <div key={msg.id} className="flex items-start gap-2 text-xs">
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${
                            msg.direction === "inbound"
                              ? "border-blue-200 text-blue-700 bg-blue-50"
                              : "border-emerald-200 text-emerald-700 bg-emerald-50"
                          }`}
                        >
                          {msg.direction}
                        </Badge>
                        <span className="text-slate-600 truncate">{msg.content}</span>
                        <span className="text-slate-400 shrink-0 ml-auto">{formatTime(msg.created_at)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Recent Appointments feed */}
                <Card className="shadow-sm border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-700">Recent Appointments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-48 overflow-y-auto">
                    {appointments.length === 0 && !loading && (
                      <p className="text-slate-400 text-xs">No appointments yet.</p>
                    )}
                    {appointments.slice(0, 5).map((appt) => (
                      <div key={appt.id} className="flex items-center gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{appt.patient_name}</p>
                          <p className="text-slate-500 truncate">{appt.dental_problem}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 border-slate-200 text-slate-500">
                          {appt.preferred_time}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ────────────── CONVERSATIONS ────────────── */}
          {activeTab === "conversations" && (
            <div className="flex h-full border-t border-slate-200 bg-white">

              {/* Left pane: patient list */}
              <div className="w-1/3 border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <Input type="search" placeholder="Search conversations..." className="bg-white border-slate-200 shadow-sm" />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {patients.length === 0 && !loading && (
                    <p className="p-6 text-sm text-slate-400">No conversations yet.</p>
                  )}
                  {patients.map((patient) => {
                    const latest = latestMessage(patient.phone_number);
                    const isActive = selectedPhone === patient.phone_number;
                    return (
                      <div
                        key={patient.phone_number}
                        onClick={() => setSelectedPhone(patient.phone_number)}
                        className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                          isActive ? "bg-blue-50/40" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-semibold text-slate-900 truncate">{patient.name}</h3>
                          {latest && (
                            <span className="text-xs text-slate-400 shrink-0 ml-2">
                              {formatTime(latest.created_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 truncate mb-2">
                          {latest ? latest.content : "No messages yet"}
                        </p>
                        <Badge variant="outline" className="text-slate-500 border-slate-200 bg-white text-[10px]">
                          {patient.phone_number}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right pane: active chat */}
              <div className="w-2/3 flex flex-col bg-slate-50/30">
                {!selectedPhone ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-slate-400">
                      <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Select a patient to view their conversation</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                          {selectedPatient ? getInitials(selectedPatient.name) : "?"}
                        </div>
                        <div>
                          <h2 className="font-semibold text-slate-900">{selectedPatient?.name ?? selectedPhone}</h2>
                          <p className="text-xs text-slate-500">{selectedPhone}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          aiPaused
                            ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 px-3 py-1"
                            : "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 px-3 py-1"
                        }
                      >
                        <span className={`w-2 h-2 rounded-full mr-2 ${aiPaused ? "bg-red-500" : "bg-green-500"}`} />
                        {aiPaused ? "AI Paused" : "AI Active"}
                      </Badge>
                    </div>

                    {/* Chat history */}
                    <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                      {activeMessages.length === 0 && (
                        <p className="text-slate-400 text-sm text-center mt-8">No messages for this patient yet.</p>
                      )}
                      {activeMessages.map((msg) => {
                        const isInbound = msg.direction === "inbound";
                        return (
                          <div
                            key={msg.id}
                            className={`flex items-end gap-2 max-w-[80%] ${isInbound ? "" : "self-end flex-row-reverse"}`}
                          >
                            {isInbound ? (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-indigo-700 text-xs font-bold">
                                {selectedPatient ? getInitials(selectedPatient.name) : "P"}
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center border border-blue-200 shadow-sm">
                                <span className="text-base">🤖</span>
                              </div>
                            )}
                            <div
                              className={`p-3 shadow-sm ${
                                isInbound
                                  ? "bg-white border border-slate-200 rounded-2xl rounded-bl-sm"
                                  : "bg-emerald-50 border border-emerald-100 rounded-2xl rounded-br-sm"
                              }`}
                            >
                              <p className="text-sm text-slate-800">{msg.content}</p>
                              <p className={`text-[10px] text-slate-400 mt-1 ${isInbound ? "text-right" : "text-left"}`}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Input / override */}
                    <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_10px_-10px_rgba(0,0,0,0.1)] z-10">
                      <div className="flex gap-2 mb-4">
                        <Input
                          placeholder={aiPaused ? "Type your message to patient..." : "Pause AI to type a manual message..."}
                          className="bg-slate-50 border-slate-200"
                          disabled={!aiPaused}
                        />
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" disabled={!aiPaused}>
                          <Send size={16} className="mr-2" /> Send
                        </Button>
                      </div>
                      <Button
                        onClick={() => setAiPaused(!aiPaused)}
                        variant={aiPaused ? "outline" : "destructive"}
                        className={`w-full h-14 text-base font-semibold transition-all ${
                          aiPaused
                            ? "border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                            : "shadow-md hover:bg-red-600/90"
                        }`}
                      >
                        {aiPaused ? "Resume AI Autopilot" : "Take Over Chat (Pause AI)"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ────────────── APPOINTMENTS ────────────── */}
          {activeTab === "appointments" && (
            <div className="p-8 max-w-5xl mx-auto">
              {appointments.length === 0 && !loading && (
                <div className="text-center py-16 text-slate-400">
                  <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No appointments booked yet.</p>
                </div>
              )}
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <Card key={appt.id} className="shadow-sm border-slate-200">
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                          {getInitials(appt.patient_name)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{appt.patient_name}</p>
                          <p className="text-xs text-slate-500">{appt.dental_problem}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-700">{appt.preferred_time}</p>
                        <p className="text-xs text-slate-400">{appt.phone_number}</p>
                      </div>
                      <Badge variant="outline" className="capitalize shrink-0 border-slate-200 text-slate-600">
                        {appt.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ────────────── SETTINGS ────────────── */}
          {activeTab === "settings" && (
            <div className="p-8 flex items-center justify-center h-full">
              <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 max-w-md">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                  <Settings size={32} className="text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Settings</h3>
                <p className="text-slate-500">This section is currently under construction for the MVP.</p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
