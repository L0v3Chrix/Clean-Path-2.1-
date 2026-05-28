import { useState, useEffect, useRef } from 'react';
import { appClient } from '@/services/appClient';
import { Send, Plus, Lock, Globe, Hash, ChevronDown, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Sidebar channel item ───────────────────────────────────────────────────
function ChannelItem({ channel, active, unread = 0, onClick }) {
  const isPrivate = channel.category === 'private' || channel.category === 'management';
  const isPublic = channel.category === 'public';
  const isLocked = channel.is_locked;
  const isDim = isLocked && !active;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors group',
        active ? 'bg-slate-600 text-white' : isDim ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      )}
    >
      {/* icon */}
      <span className="flex-shrink-0 w-4 flex items-center justify-center">
        {isPrivate || isLocked
          ? <Lock className="w-3 h-3 opacity-70" />
          : isPublic
            ? <Globe className="w-3 h-3 opacity-70" />
            : <Hash className="w-3 h-3 opacity-70" />
        }
      </span>

      {/* name + emoji */}
      <span className={cn('flex-1 truncate text-left', unread > 0 && 'font-bold text-white')}>
        {channel.emoji ? `${channel.emoji} ` : ''}{channel.name}
      </span>

      {/* unread badge */}
      {unread > 0 && (
        <span className="flex-shrink-0 bg-blue-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unread}
        </span>
      )}
    </button>
  );
}

// ─── Sidebar section ────────────────────────────────────────────────────────
function SidebarSection({ label, channels, activeChannel, setActiveChannel, canAdd, onAdd, showMoreLabel }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? channels : channels.slice(0, 10);

  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-3 py-1 group">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold tracking-wider text-slate-400 hover:text-white uppercase"
        >
          <ChevronDown className={cn('w-3 h-3 transition-transform', collapsed && '-rotate-90')} />
          {label}
        </button>
        {canAdd && (
          <button onClick={onAdd} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-0.5">
          {visible.map(ch => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              active={activeChannel?.id === ch.id}
              onClick={() => setActiveChannel(ch)}
            />
          ))}
          {!showAll && channels.length > 10 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-slate-500 hover:text-slate-300 px-3 py-0.5"
            >
              More...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Chat Page ─────────────────────────────────────────────────────────
export default function Chat() {
  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const isAdmin = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'manager';

  useEffect(() => { init(); }, []);
  useEffect(() => { if (activeChannel) loadMessages(activeChannel.id); }, [activeChannel]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const init = async () => {
    try {
      const u = await appClient.auth.me();
      setUser(u);
      const ch = await appClient.entities.ChatChannel.list('sort_order', 100);
      setChannels(ch);
      // Auto-select first non-locked public channel
      const first = ch.find(c => !c.is_locked && c.status === 'active') || ch[0];
      if (first) setActiveChannel(first);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadMessages = async (channelId) => {
    try {
      const msgs = await appClient.entities.ChatMessage.filter({ channel_id: channelId }, 'created_date', 100);
      setMessages(msgs);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!activeChannel) return;
    const unsub = appClient.entities.ChatMessage.subscribe((event) => {
      if (event.data?.channel_id !== activeChannel?.id) return;
      if (event.type === 'create') setMessages(prev => [...prev, event.data]);
      else if (event.type === 'delete') setMessages(prev => prev.filter(m => m.id !== event.id));
    });
    return unsub;
  }, [activeChannel?.id]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;
    if (activeChannel.is_locked) return;
    setSending(true);
    try {
      await appClient.entities.ChatMessage.create({
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

  const handleAddChannel = async (category) => {
    const name = prompt('Channel name:');
    if (!name) return;
    const access = category === 'private' ? 'staff_only' : category === 'management' ? 'management_only' : 'residents_and_staff';
    const ch = await appClient.entities.ChatChannel.create({
      name: name.trim(),
      category,
      type: 'custom',
      access_level: access,
      organization_id: 'default',
      sort_order: 99,
    });
    setChannels(prev => [...prev, ch]);
    setActiveChannel(ch);
  };

  const formatTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d), today = new Date();
    return dt.toDateString() === today.toDateString() ? 'Today' : dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Group channels by category
  const favorites  = channels.filter(c => c.is_favorite && c.status === 'active');
  const publicChs  = channels.filter(c => c.category === 'public' && c.status === 'active');
  const privateChs = channels.filter(c => c.category === 'private' && c.status === 'active');
  const mgmtChs    = channels.filter(c => c.category === 'management' && c.status === 'active');
  const directChs  = channels.filter(c => c.category === 'direct' && c.status === 'active');

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
    </div>
  );

  const channelIsReadonly = activeChannel?.is_locked;
  const channelBadge = activeChannel?.access_level === 'management_only'
    ? <Badge className="bg-purple-100 text-purple-700 border-0 text-xs ml-auto">Management</Badge>
    : activeChannel?.access_level === 'staff_only'
    ? <Badge className="bg-amber-100 text-amber-700 border-0 text-xs ml-auto">Staff Only</Badge>
    : activeChannel?.category === 'public'
    ? <Badge className="bg-blue-100 text-blue-700 border-0 text-xs ml-auto">Public</Badge>
    : null;

  return (
    <div className="flex h-full bg-white" style={{ height: 'calc(100vh - 56px)' }}>
      {/* ── Sidebar ── */}
      <div className="w-64 flex-shrink-0 bg-slate-800 text-white flex flex-col overflow-hidden">
        {/* Workspace header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="font-bold text-sm text-white">RCL Community</p>
          <p className="text-xs text-slate-400">Recovery Community Living</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {/* Favorites */}
          {favorites.length > 0 && (
            <SidebarSection
              label="Favorite Channels"
              channels={favorites}
              activeChannel={activeChannel}
              setActiveChannel={setActiveChannel}
            />
          )}

          {/* Public */}
          <SidebarSection
            label="Public Channels"
            channels={publicChs}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
            canAdd={isAdmin}
            onAdd={() => handleAddChannel('public')}
          />

          {/* Private */}
          <SidebarSection
            label="Private Channels"
            channels={privateChs}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
            canAdd={isAdmin}
            onAdd={() => handleAddChannel('private')}
          />

          {/* Management — admin only */}
          {isAdmin && mgmtChs.length > 0 && (
            <SidebarSection
              label="Management"
              channels={mgmtChs}
              activeChannel={activeChannel}
              setActiveChannel={setActiveChannel}
              canAdd={isAdmin}
              onAdd={() => handleAddChannel('management')}
            />
          )}

          {/* Direct messages */}
          <SidebarSection
            label="Direct Messages"
            channels={directChs}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
            canAdd
            onAdd={() => handleAddChannel('direct')}
          />
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {activeChannel ? (
          <>
            {/* Channel header */}
            <div className="border-b px-5 py-3 flex items-center gap-2 bg-white flex-shrink-0">
              <span className="text-slate-400">
                {activeChannel.category === 'private' || activeChannel.is_locked
                  ? <Lock className="w-4 h-4" />
                  : activeChannel.category === 'public'
                  ? <Globe className="w-4 h-4" />
                  : <Hash className="w-4 h-4" />}
              </span>
              <span className="font-semibold text-slate-800">
                {activeChannel.emoji ? `${activeChannel.emoji} ` : ''}{activeChannel.name}
              </span>
              {activeChannel.description && (
                <span className="text-xs text-slate-400 border-l pl-3 hidden sm:block">{activeChannel.description}</span>
              )}
              {channelBadge}
              {activeChannel.is_locked && (
                <Badge className="bg-slate-100 text-slate-500 border-0 text-xs ml-auto">Archived / Read-only</Badge>
              )}
            </div>

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-1">
              {messages.length === 0 ? (
                <div className="text-center text-slate-400 py-16 text-sm">
                  <Hash className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No messages yet in <span className="font-medium">
                    {activeChannel.emoji}{activeChannel.name}
                  </span></p>
                  {!channelIsReadonly && <p className="text-xs mt-1">Be the first to say something!</p>}
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isOwn = msg.sender_id === user?.id;
                  const prevMsg = messages[i - 1];
                  const sameAuthor = prevMsg?.sender_id === msg.sender_id;
                  return (
                    <div key={msg.id} className={cn("flex gap-3", isOwn ? "flex-row-reverse" : "flex-row", !sameAuthor ? "mt-4" : "mt-0.5")}>
                      {!sameAuthor && !isOwn && (
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                          {msg.sender_name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      {sameAuthor && !isOwn && <div className="w-8" />}
                      <div className={cn("max-w-[70%]", isOwn && "items-end flex flex-col")}>
                        {!sameAuthor && (
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
            {channelIsReadonly ? (
              <div className="border-t p-4 bg-slate-50 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" /> This channel is archived and read-only.
              </div>
            ) : (
              <form onSubmit={sendMessage} className="border-t p-4 flex gap-3 bg-white flex-shrink-0">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeChannel.category === 'public' ? '#' : '🔒'}${activeChannel.name}…`}
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" disabled={!newMessage.trim() || sending} className="bg-teal-600 hover:bg-teal-700">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Select a channel to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}