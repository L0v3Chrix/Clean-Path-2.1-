import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Plus, Hash, Lock, Globe, Users, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Chat() {
  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (activeChannel) loadMessages(activeChannel.id);
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const init = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const ch = await base44.entities.ChatChannel.list();
      setChannels(ch);
      if (ch.length > 0) setActiveChannel(ch[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadMessages = async (channelId) => {
    try {
      const msgs = await base44.entities.ChatMessage.filter({ channel_id: channelId }, 'created_date', 100);
      setMessages(msgs);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!activeChannel) return;
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.channel_id !== activeChannel?.id) return;
      if (event.type === 'create') setMessages(prev => [...prev, event.data]);
      else if (event.type === 'delete') setMessages(prev => prev.filter(m => m.id !== event.id));
    });
    return unsub;
  }, [activeChannel?.id]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;
    setSending(true);
    try {
      await base44.entities.ChatMessage.create({
        channel_id: activeChannel.id,
        organization_id: activeChannel.organization_id,
        sender_id: user.id,
        sender_name: user.full_name || user.email,
        sender_role: user.role || 'user',
        content: newMessage.trim(),
      });
      setNewMessage('');
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const channelIcon = (type, access) => {
    if (access === 'staff_only' || access === 'management_only') return <Lock className="w-3 h-3" />;
    if (type === 'resources' || access === 'public') return <Globe className="w-3 h-3" />;
    return <Hash className="w-3 h-3" />;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex h-full bg-white">
      {/* Channel list */}
      <div className="w-64 border-r bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-bold text-sm">Community Chat</h2>
          <p className="text-xs text-slate-400 mt-0.5">Your housing community</p>
        </div>

        {channels.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs">
            No channels yet.
            <br />
            <span className="text-teal-400">Ask an admin to create channels.</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2">
            {['location', 'general', 'announcements', 'resources', 'peer_support', 'staff_only', 'management_only', 'custom'].map(type => {
              const typeChannels = channels.filter(c => c.type === type || c.access_level === type);
              if (typeChannels.length === 0) return null;
              const labels = {
                location: 'LOCATIONS', general: 'GENERAL', announcements: 'ANNOUNCEMENTS',
                resources: 'RESOURCES', peer_support: 'PEER SUPPORT', staff_only: 'STAFF ONLY',
                management_only: 'MANAGEMENT', custom: 'CHANNELS'
              };
              return (
                <div key={type} className="mb-2">
                  <p className="text-xs text-slate-500 px-4 py-1 font-semibold tracking-wider">{labels[type]}</p>
                  {typeChannels.map(ch => (
                    <button
                      key={ch.id}
                      className={cn(
                        "w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                        activeChannel?.id === ch.id
                          ? "bg-teal-500/20 text-teal-400"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      )}
                      onClick={() => setActiveChannel(ch)}
                    >
                      {channelIcon(ch.type, ch.access_level)}
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Add channel - staff only */}
        {user?.role !== 'user' && user?.role !== 'resident' && (
          <div className="p-3 border-t border-slate-700">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-slate-400 hover:text-white gap-2 text-xs"
              onClick={async () => {
                const name = prompt('Channel name:');
                if (!name) return;
                const ch = await base44.entities.ChatChannel.create({
                  name, type: 'custom', access_level: 'residents_and_staff',
                  organization_id: 'default',
                });
                setChannels(prev => [...prev, ch]);
                setActiveChannel(ch);
              }}
            >
              <Plus className="w-3 h-3" /> Add Channel
            </Button>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            {/* Channel header */}
            <div className="border-b px-5 py-3 flex items-center gap-3 bg-white">
              <span className="text-slate-500">{channelIcon(activeChannel.type, activeChannel.access_level)}</span>
              <span className="font-semibold text-slate-800">{activeChannel.name}</span>
              {activeChannel.description && <span className="text-xs text-slate-400 border-l pl-3">{activeChannel.description}</span>}
              {activeChannel.access_level === 'staff_only' && (
                <Badge className="bg-amber-100 text-amber-700 border-0 text-xs ml-auto">Staff Only</Badge>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-1">
              {messages.length === 0 ? (
                <div className="text-center text-slate-400 py-16 text-sm">
                  <Hash className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No messages yet in <span className="font-medium">#{activeChannel.name}</span></p>
                  <p className="text-xs mt-1">Be the first to say something!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isOwn = msg.sender_id === user?.id;
                  const prevMsg = messages[i - 1];
                  const sameAuthor = prevMsg?.sender_id === msg.sender_id;
                  const showHeader = !sameAuthor;
                  return (
                    <div key={msg.id} className={cn("flex gap-3", isOwn ? "flex-row-reverse" : "flex-row", showHeader ? "mt-4" : "mt-0.5")}>
                      {showHeader && !isOwn && (
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                          {msg.sender_name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      {!showHeader && !isOwn && <div className="w-8" />}
                      <div className={cn("max-w-[70%]", isOwn && "items-end flex flex-col")}>
                        {showHeader && (
                          <div className={cn("flex items-center gap-2 mb-1", isOwn && "flex-row-reverse")}>
                            <span className="text-xs font-semibold text-slate-700">{isOwn ? 'You' : msg.sender_name}</span>
                            <span className="text-xs text-slate-400">{formatDate(msg.created_date)} {formatTime(msg.created_date)}</span>
                            {msg.sender_role && msg.sender_role !== 'user' && (
                              <Badge className="bg-slate-100 text-slate-500 border-0 text-xs capitalize py-0">
                                {msg.sender_role.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className={cn(
                          "rounded-2xl px-4 py-2 text-sm",
                          isOwn ? "bg-teal-600 text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="border-t p-4 flex gap-3 bg-white">
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder={`Message #${activeChannel.name}...`}
                className="flex-1"
                disabled={sending}
              />
              <Button type="submit" disabled={!newMessage.trim() || sending} className="bg-teal-600 hover:bg-teal-700">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Hash className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Select a channel to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}