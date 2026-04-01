"use client";

import React, { useState } from "react";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Calendar, 
  Settings, 
  User, 
  Send 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [aiPaused, setAiPaused] = useState(false);

  return (
    <div className="flex h-screen w-full bg-white text-slate-900 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 text-2xl">🦷</span> DentalFront
          </h1>
          <p className="text-xs text-slate-500 mt-1">AI Receptionist MVP</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
              activeTab === "overview" 
                ? "bg-blue-100 text-blue-700 font-medium" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <LayoutDashboard size={20} />
            Overview
          </button>
          
          <button
            onClick={() => setActiveTab("conversations")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
              activeTab === "conversations" 
                ? "bg-blue-100 text-blue-700 font-medium" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <MessageSquare size={20} />
            Conversations
          </button>
          
          <button
            onClick={() => setActiveTab("appointments")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
              activeTab === "appointments" 
                ? "bg-blue-100 text-blue-700 font-medium" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Calendar size={20} />
            Appointments
          </button>
          
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
              activeTab === "settings" 
                ? "bg-blue-100 text-blue-700 font-medium" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Settings size={20} />
            Settings
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
              Dr
            </div>
            <div>
              <p className="font-medium text-slate-900">Dr. Admin</p>
              <p className="text-slate-500 text-xs">ABC Dental Clinic</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
        
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8 shadow-sm z-10">
          <h2 className="text-lg font-semibold capitalize text-slate-800">
            {activeTab}
          </h2>
        </header>

        {/* Content Views */}
        <div className="flex-1 overflow-auto">
          {activeTab === "overview" && (
            <div className="p-8 space-y-6 max-w-7xl mx-auto">
              {/* Metric Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm border-0 font-medium text-slate-500">
                      WhatsApp Messages
                    </CardTitle>
                    <MessageSquare size={16} className="text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">42</div>
                    <p className="text-xs text-slate-500 mt-1">Today</p>
                  </CardContent>
                </Card>
                
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                      Appointments Booked
                    </CardTitle>
                    <Calendar size={16} className="text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">8</div>
                    <p className="text-xs text-slate-500 mt-1">Fully handled by AI</p>
                  </CardContent>
                </Card>
                
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                      Missed Chats
                    </CardTitle>
                    <User size={16} className="text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">0</div>
                    <p className="text-xs text-slate-500 mt-1">Requiring manual intervention</p>
                  </CardContent>
                </Card>
                
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                      Upcoming Today
                    </CardTitle>
                    <Calendar size={16} className="text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">12</div>
                    <p className="text-xs text-slate-500 mt-1">Total appointments</p>
                  </CardContent>
                </Card>
              </div>

              {/* Placeholder for future overview widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <Card className="shadow-sm border-slate-200 h-64 flex items-center justify-center bg-slate-50/50">
                  <p className="text-slate-400 text-sm">Traffic Chart Placeholder</p>
                </Card>
                <Card className="shadow-sm border-slate-200 h-64 flex items-center justify-center bg-slate-50/50">
                  <p className="text-slate-400 text-sm">Recent Activity Stream Placeholder</p>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "conversations" && (
            <div className="flex h-full border-t border-slate-200 bg-white">
              {/* Left Pane: Chat List (1/3 width) */}
              <div className="w-1/3 border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <Input 
                    type="search" 
                    placeholder="Search conversations..." 
                    className="bg-white border-slate-200 shadow-sm"
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {/* Mock Chat Item */}
                  <div className="p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer bg-blue-50/30 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-slate-900">Sara Ahmed</h3>
                      <span className="text-xs text-slate-400">10:42 AM</span>
                    </div>
                    <p className="text-sm text-slate-600 truncate mb-2">
                      Acha, mujhe daant mein dard hai, koi appointment mil sakti hai?
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">
                        Needs Attention
                      </Badge>
                      <Badge variant="outline" className="text-slate-500 border-slate-200 bg-white">
                        +92 *** ****123
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Other minor mock items to fill the list */}
                  <div className="p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors opacity-70">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-medium text-slate-800">Ali Khan</h3>
                      <span className="text-xs text-slate-400">09:15 AM</span>
                    </div>
                    <p className="text-sm text-slate-600 truncate">
                      Bohat shukriya, main time par pohnch jaunga.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Pane: Active Chat View (2/3 width) */}
              <div className="w-2/3 flex flex-col bg-slate-50/30">
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                      SA
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900">Sara Ahmed</h2>
                      <p className="text-xs text-slate-500">Online on WhatsApp</p>
                    </div>
                  </div>
                  <Badge 
                    className={
                      aiPaused 
                        ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 px-3 py-1" 
                        : "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 px-3 py-1"
                    }
                    variant="outline"
                  >
                    <span className={`w-2 h-2 rounded-full mr-2 ${aiPaused ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    {aiPaused ? "AI Paused" : "AI Active"}
                  </Badge>
                </div>

                {/* Chat History */}
                <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                  {/* Patient Message */}
                  <div className="flex items-end gap-2 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-indigo-700 text-xs font-bold">
                      SA
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm p-3 shadow-sm">
                      <p className="text-sm text-slate-800">
                        Assalam o Alaikum. Clinic kis waqt khulta hai?
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 text-right">10:35 AM</p>
                    </div>
                  </div>

                  {/* AI Message */}
                  <div className="flex items-end gap-2 max-w-[80%] self-end flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center border border-blue-200 shadow-sm">
                      <span className="text-lg">🤖</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl rounded-br-sm p-3 shadow-sm">
                      <p className="text-sm text-slate-800">
                        Walaikum Assalam! Humara clinic peer se hafte tak (Monday–Saturday) subah 10 baje se shaam 7 baje tak khula hota hai. Main aapki kya madad kar sakti hoon?
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 text-left">10:35 AM</p>
                    </div>
                  </div>

                  {/* Patient Message */}
                  <div className="flex items-end gap-2 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-indigo-700 text-xs font-bold">
                      SA
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm p-3 shadow-sm">
                      <p className="text-sm text-slate-800">
                        Acha, mujhe daant mein dard hai, koi appointment mil sakti hai aaj?
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 text-right">10:42 AM</p>
                    </div>
                  </div>
                  
                  {/* AI Message (typing indicator simulation if AI is active) */}
                  {!aiPaused && (
                     <div className="flex items-end gap-2 max-w-[80%] self-end flex-row-reverse opacity-60">
                     <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center border border-blue-200">
                       <span className="text-lg">🤖</span>
                     </div>
                     <div className="bg-emerald-50 border border-emerald-100 rounded-2xl rounded-br-sm p-3">
                       <div className="flex gap-1 py-1">
                         <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce"></div>
                         <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                         <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                       </div>
                     </div>
                   </div>
                  )}
                </div>

                {/* Input Area / Override Control */}
                <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_10px_-10px_rgba(0,0,0,0.1)] z-10">
                  {/* Manual message input */}
                  <div className="flex gap-2 mb-4">
                    <Input 
                      placeholder={aiPaused ? "Type your message to patient..." : "Pause AI to type a manual message..."} 
                      className="bg-slate-50 border-slate-200"
                      disabled={!aiPaused}
                    />
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      disabled={!aiPaused}
                    >
                      <Send size={16} className="mr-2" /> Send
                    </Button>
                  </div>

                  {/* Massive Override Button */}
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
              </div>
            </div>
          )}

          {/* Placeholder Views for other tabs */}
          {(activeTab === "appointments" || activeTab === "settings") && (
            <div className="p-8 flex items-center justify-center h-full">
              <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 max-w-md">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                  {activeTab === "appointments" ? (
                    <Calendar size={32} className="text-slate-400" />
                  ) : (
                    <Settings size={32} className="text-slate-400" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2 capitalize">
                  {activeTab} View
                </h3>
                <p className="text-slate-500">
                  This section is currently under construction for the MVP. It will be available in a future update.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
