'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Activity,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  Gamepad2,
  Gift,
  Link2,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { matchCatalogEntry } from '@/lib/acx-catalog';
import type { DropItem, ParsedWebhookEvent } from '@/lib/store';
import acxBackdrop from '../../photo/noFilter.jpeg';
import acxLogo from '../../photo/logo.jpg';
import acxIcon from '../../photo/anime-crusaders-x-icon.jpg';
import discordIcon from '../../photo/discord.png';

const rarityLabels: Record<string, string> = {
  secret: 'Secret',
  mythic: 'Mythic',
  legendary: 'Legendary',
  shiny: 'Shiny',
  epic: 'Epic',
  rare: 'Rare',
  normal: 'Normal',
};

const ACTIVITY_PAGE_SIZE = 10;

type UserSummary = {
  name: string;
  displayName: string;
  avatarUrl?: string | null;
};

function cleanText(value?: string) {
  return value?.replaceAll('Â·', '·').replaceAll('ï¿½', '·') ?? '';
}

function numberFrom(value?: string) {
  if (!value) return 0;
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function resolveDrop(drop: DropItem) {
  const catalogMatch = drop.catalogId
    ? matchCatalogEntry(drop.name, drop.catalogType)
    : matchCatalogEntry(drop.originalName || drop.name, drop.catalogType);
  return {
    ...drop,
    name: catalogMatch?.entry.name || cleanText(drop.name),
    catalogType: drop.catalogType || catalogMatch?.entry.type,
    catalogRarity: drop.catalogRarity || catalogMatch?.entry.rarity || undefined,
    icon: drop.icon || catalogMatch?.entry.icon || undefined,
  };
}

function initials(name: string) {
  return Array.from(cleanText(name).trim())[0]?.toUpperCase() || '?';
}

export default function Home() {
  const [selectedUser, setSelectedUser] = useState('');
  const [availableUsers, setAvailableUsers] = useState<UserSummary[]>([]);
  const [events, setEvents] = useState<ParsedWebhookEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const pollTimerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncFromUrl = () => {
      setSelectedUser(new URLSearchParams(window.location.search).get('user') ?? '');
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    fetch('/api/users', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setAvailableUsers(data?.users ?? []))
      .catch(() => setAvailableUsers([]))
      .finally(() => setUsersLoading(false));

    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const fetchEvents = useCallback(async (user: string) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/webhooks/${encodeURIComponent(user)}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events ?? []);
      }
    } catch (error) {
      console.error('Failed to poll events:', error);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedUser) return;

    const initialFetch = window.setTimeout(() => fetchEvents(selectedUser), 0);
    pollTimerRef.current = window.setInterval(() => fetchEvents(selectedUser), 1500);
    return () => {
      window.clearTimeout(initialFetch);
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [fetchEvents, selectedUser]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('th-TH');
    if (!query) return availableUsers;
    return availableUsers.filter((user) =>
      `${cleanText(user.displayName)} ${cleanText(user.name)}`
        .toLocaleLowerCase('th-TH')
        .includes(query),
    );
  }, [availableUsers, searchQuery]);

  const directoryProfile = availableUsers.find((user) => user.name === selectedUser);
  const eventProfile = events.find((event) => event.profile)?.profile;
  const selectedDisplayName = eventProfile?.displayName || directoryProfile?.displayName || selectedUser;
  const selectedAvatarUrl = eventProfile?.avatarUrl || directoryProfile?.avatarUrl;

  const farmOverview = useMemo(() => {
    const latestRun = events.find((event) => event.totalRuns || event.result);
    const drops = new Map<string, {
      name: string;
      rarity: string;
      count: number;
      catalogType?: 'item' | 'unit';
      icon?: string;
    }>();

    for (const event of events) {
      for (const drop of event.drops ?? []) {
        const resolved = resolveDrop(drop);
        const name = cleanText(resolved.name).trim();
        if (!name) continue;
        const key = `${name.toLocaleLowerCase('en-US')}::${drop.rarity || 'normal'}`;
        const existing = drops.get(key);
        if (existing) existing.count += drop.quantity || 1;
        else drops.set(key, {
          name,
          rarity: drop.rarity || 'normal',
          count: drop.quantity || 1,
          catalogType: resolved.catalogType,
          icon: resolved.icon,
        });
      }
    }

    const dropItems = Array.from(drops.values()).sort((left, right) => {
      if (Boolean(left.icon) !== Boolean(right.icon)) return left.icon ? -1 : 1;
      return right.count - left.count || left.name.localeCompare(right.name);
    });
    return {
      totalRuns: latestRun?.totalRuns || String(events.filter((event) => event.result).length),
      gold: numberFrom(latestRun?.gold),
      gems: numberFrom(latestRun?.gems),
      dropItems,
    };
  }, [events]);

  const overviewItems = [
    ...(farmOverview.gold > 0
      ? [{ key: 'currency-gold', name: 'Gold', count: farmOverview.gold, icon: '/items/gold.png', rarity: 'currency' }]
      : []),
    ...(farmOverview.gems > 0
      ? [{ key: 'currency-gems', name: 'Gems', count: farmOverview.gems, icon: undefined, rarity: 'currency' }]
      : []),
    ...farmOverview.dropItems.map((drop) => ({ ...drop, key: `${drop.name}-${drop.rarity}` })),
  ];

  const totalActivityPages = Math.max(1, Math.ceil(events.length / ACTIVITY_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, totalActivityPages);
  const visibleEvents = events.slice(
    (safeActivityPage - 1) * ACTIVITY_PAGE_SIZE,
    safeActivityPage * ACTIVITY_PAGE_SIZE,
  );

  const openUser = (user: string) => {
    setEventsLoading(true);
    setActivityPage(1);
    setSelectedUser(user);
    window.localStorage.setItem('acx_active_user', user);
    const url = new URL(window.location.href);
    url.searchParams.set('user', user);
    window.history.pushState({}, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const returnToDirectory = () => {
    setSelectedUser('');
    setEvents([]);
    setActivityPage(1);
    const url = new URL(window.location.href);
    url.searchParams.delete('user');
    window.history.pushState({}, '', url.toString());
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}/?user=${encodeURIComponent(selectedUser)}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleClear = async () => {
    if (!selectedUser || !window.confirm('ล้างประวัติการฟาร์มของผู้ใช้นี้ทั้งหมดใช่ไหม?')) return;
    await fetch(`/api/webhooks/${encodeURIComponent(selectedUser)}`, { method: 'DELETE' });
    setEvents([]);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={returnToDirectory} aria-label="กลับหน้ารายชื่อผู้เล่น">
            <span className="brand-mark">
              <Image src={acxIcon} alt="" width={42} height={42} priority />
            </span>
            <span>
              <b>ACX Farm</b>
              <small>Webhook tracker</small>
            </span>
          </button>
          {selectedUser ? (
            <div className="live-pill"><i /> Live update</div>
          ) : (
            <span className="topbar-caption">PLAYER DIRECTORY</span>
          )}
        </div>
      </header>

      <main className="dashboard">
        {!selectedUser ? (
          <section className="directory-section">
            <section className="game-hero" aria-label="Anime Crusaders X farm tracker">
              <Image
                className="hero-backdrop"
                src={acxBackdrop}
                alt="ฉากจาก Anime Crusaders X"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 900px"
              />
              <div className="hero-haze" />
              <Image className="hero-logo-ghost" src={acxLogo} alt="" aria-hidden="true" />
              <div className="hero-copy">
                <span className="hero-eyebrow"><i /> LIVE FARM INTELLIGENCE</span>
                <h1>ทุกดรอป ทุกรีวอร์ด<br /><em>รวมไว้ในที่เดียว</em></h1>
                <p>ติดตามผลการฟาร์มจาก Anime Crusaders X แบบเรียลไทม์ ผ่าน Discord Webhook</p>
                <a
                  className="discord-cta"
                  href="https://discord.gg/Q3SmcgQCCt"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Image src={discordIcon} alt="" width={38} height={38} />
                  <span>
                    <b>เข้าร่วม Discord</b>
                  </span>
                </a>
              </div>
              <div className="hero-poster">
                <Image src={acxIcon} alt="Anime Crusaders X" width={512} height={512} priority />
                <span><i /> TRACKING ONLINE</span>
              </div>
            </section>

            <section className="usage-guide" aria-labelledby="usage-guide-title">
              <div className="guide-heading">
                <div>
                  <span className="section-kicker">QUICK START</span>
                  <h2 id="usage-guide-title">เริ่มติดตามการฟาร์มใน 3 ขั้นตอน</h2>
                </div>
                <p>ตั้งค่าครั้งเดียว แล้วผลการฟาร์มจะอัปเดตบนหน้าเว็บอัตโนมัติ</p>
              </div>
              <div className="guide-grid">
                <article className="guide-card">
                  <span className="guide-icon"><Link2 size={22} /></span>
                  <span className="guide-step">DISCORD SETUP</span>
                  <h3>สร้าง Webhook ใน Discord</h3>
                  <p>กดปุ่มสร้าง Webhook จากบอท แล้วคัดลอกลิงก์ประจำห้องฟาร์มของคุณ</p>
                </article>
                <article className="guide-card">
                  <span className="guide-icon"><Gamepad2 size={22} /></span>
                  <span className="guide-step">GAME SETUP</span>
                  <h3>นำลิงก์ไปใส่ในเกม</h3>
                  <p>วางลิงก์ในช่อง Webhook ของเกม เปิดใช้งาน แล้วเริ่มปล่อยฟาร์มได้เลย</p>
                </article>
                <article className="guide-card">
                  <span className="guide-icon"><Gift size={22} /></span>
                  <span className="guide-step">LIVE DASHBOARD</span>
                  <h3>กลับมาดูรีวอร์ดบนเว็บ</h3>
                  <p>เลือกรายชื่อของคุณเพื่อดูรอบฟาร์ม ของดรอป และรีวอร์ดล่าสุดแบบเรียลไทม์</p>
                </article>
              </div>
            </section>

            <div className="directory-intro">
              <div>
                <span className="section-kicker"><UsersRound size={15} /> PLAYERS</span>
                <h1>เลือกรายชื่อผู้เล่น</h1>
                <p>ค้นหาผู้เล่นเพื่อดูประวัติการฟาร์มและของที่ดรอปล่าสุด</p>
              </div>
              <span className="player-count">{availableUsers.length} ผู้เล่น</span>
            </div>

            <label className="search-field">
              <Search size={19} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ค้นหาชื่อผู้เล่น..."
                aria-label="ค้นหาชื่อผู้เล่น"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} aria-label="ล้างคำค้นหา"><X size={16} /></button>
              )}
              <kbd>⌘ K</kbd>
            </label>

            <div className="list-heading">
              <span>รายชื่อทั้งหมด</span>
              {!usersLoading && searchQuery && <span>พบ {filteredUsers.length} รายการ</span>}
            </div>

            {usersLoading ? (
              <div className="user-grid" aria-label="กำลังโหลดรายชื่อ">
                {[0, 1, 2].map((item) => <div className="user-card skeleton" key={item} />)}
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="user-grid">
                {filteredUsers.map((user) => (
                  <button className="user-card" key={user.name} onClick={() => openUser(user.name)}>
                    <span className={`user-avatar ${user.avatarUrl ? 'has-image' : ''}`}>
                      {user.avatarUrl ? (
                        <Image src={user.avatarUrl} alt={`รูปโปรไฟล์ Discord ของ ${user.displayName}`} width={48} height={48} />
                      ) : initials(user.displayName)}
                    </span>
                    <span className="user-info">
                      <b>{cleanText(user.displayName)}</b>
                      <small><i /> {user.displayName !== user.name ? `@${cleanText(user.name)} · ` : ''}มีข้อมูล Webhook</small>
                    </span>
                    <span className="open-user"><Eye size={17} /></span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="directory-empty">
                <Search size={26} />
                <h2>ไม่พบรายชื่อที่ค้นหา</h2>
                <p>ลองตรวจสอบการสะกดหรือใช้คำค้นหาอื่น</p>
                <button onClick={() => setSearchQuery('')}>ล้างคำค้นหา</button>
              </div>
            )}
          </section>
        ) : (
          <section className="logs-section">
            <button className="back-button" onClick={returnToDirectory}>
              <ArrowLeft size={16} /> กลับหน้ารายชื่อ
            </button>

            <div className="logs-header">
              <div className="profile-heading">
                <span className={`profile-avatar ${selectedAvatarUrl ? 'has-image' : ''}`}>
                  {selectedAvatarUrl ? (
                    <Image src={selectedAvatarUrl} alt={`รูปโปรไฟล์ Discord ของ ${selectedDisplayName}`} width={60} height={60} />
                  ) : initials(selectedDisplayName)}
                </span>
                <div>
                  <span className="section-kicker">FARM LOG</span>
                  <h1>{cleanText(selectedDisplayName)}</h1>
                  <p>ประวัติจาก Discord Webhook · อัปเดตอัตโนมัติ</p>
                </div>
              </div>
              <div className="logs-actions">
                <button className="share-button" onClick={copyShareLink}>
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  {copiedLink ? 'คัดลอกแล้ว' : 'แชร์ลิงก์'}
                </button>
                {events.length > 0 && (
                  <button className="icon-button" onClick={handleClear} title="ล้างประวัติ" aria-label="ล้างประวัติ">
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </div>

            {!eventsLoading && <section className="farm-overview" aria-label="ภาพรวมการฟาร์ม">
              <div className="overview-heading">
                <div>
                  <span className="section-kicker"><Activity size={14} /> FARM OVERVIEW</span>
                  <h2>ภาพรวมการฟาร์ม</h2>
                </div>
                <span>{farmOverview.totalRuns} รอบ · {overviewItems.length} รายการ</span>
              </div>

              {overviewItems.length > 0 ? (
                <div className="loot-showcase">
                  {overviewItems.map((item, itemIndex) => (
                    <article className={`loot-tile rarity-${item.rarity || 'normal'}`} key={item.key} title={`${item.name} ×${item.count.toLocaleString()}`}>
                      <div className="loot-icon-wrap">
                        {item.icon ? (
                          <Image className="loot-icon" src={item.icon} alt={item.name} width={112} height={112} loading={itemIndex === 0 ? 'eager' : 'lazy'} />
                        ) : (
                          <span className="loot-icon-fallback" aria-hidden="true">{initials(item.name)}</span>
                        )}
                        <b>×{item.count.toLocaleString()}</b>
                      </div>
                      <span>{item.name}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="loot-empty">ยังไม่มีของดรอปสะสม</div>
              )}
            </section>}

            <div className="feed-meta">
              <span>ACTIVITY LOG</span>
              <span>{events.length} รายการ · หน้า {safeActivityPage}/{totalActivityPages}</span>
            </div>

            {eventsLoading ? (
              <div className="empty-state">
                <div className="loading-orb" />
                <h2>กำลังโหลดบันทึก</h2>
                <p>กำลังดึงข้อมูลล่าสุดจาก Webhook</p>
              </div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <h2>ยังไม่มีบันทึกการฟาร์ม</h2>
                <p>เมื่อเกมส่งผลผ่าน Discord Webhook ข้อมูลจะปรากฏที่นี่อัตโนมัติ</p>
              </div>
            ) : (
              <>
                <div className="event-list">
                {visibleEvents.map((event, index) => {
                  const hasSecret = event.drops?.some((drop) => drop.rarity === 'secret');
                  const hasRare = hasSecret || event.drops?.some((drop) => drop.rarity !== 'normal');
                  return (
                    <article className={`event-card ${hasSecret ? 'is-secret' : hasRare ? 'is-rare' : ''}`} key={event.id}>
                      <div className="event-content">
                        <div className="event-head">
                          <div className="event-title-wrap">
                            <span className={`result-badge ${hasSecret ? 'secret' : hasRare ? 'rare' : ''}`}>
                              {hasSecret ? 'SECRET DROP' : hasRare ? 'RARE DROP' : event.result || 'SYSTEM LOG'}
                            </span>
                            <h2>{cleanText(event.eventType)}</h2>
                          </div>
                          <time dateTime={event.timestamp}>
                            {new Date(event.timestamp).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </time>
                        </div>

                        {event.mapName && <div className="map-row">{cleanText(event.mapName)}</div>}

                        {(event.wave || event.duration || event.totalRuns || event.gems || event.gold) && (
                          <div className="metrics-row">
                            {event.wave && <div><span>Wave</span><b>{event.wave}</b></div>}
                            {event.duration && <div><span>ระยะเวลา</span><b>{event.duration}</b></div>}
                            {event.totalRuns && <div><span>รอบทั้งหมด</span><b>{event.totalRuns}</b></div>}
                            {(event.gems || event.gold) && (
                              <div className="reward-metric"><span>รางวัล</span><b>
                                {event.gems && <i>Gems {cleanText(event.gems)}</i>}
                                {event.gold && <i>Gold {event.gold}</i>}
                              </b></div>
                            )}
                          </div>
                        )}

                        {event.drops?.length > 0 && (
                          <div className="drops-block">
                            <p>ของที่ดรอป</p>
                            <div className="drop-list">
                              {event.drops.map((drop, dropIndex) => {
                                const resolved = resolveDrop(drop);
                                return (
                                  <span className={`drop-chip rarity-${drop.rarity || 'normal'}`} key={`${resolved.name}-${dropIndex}`} title={resolved.catalogRarity ? `Wiki rarity: ${resolved.catalogRarity}` : undefined}>
                                    {resolved.name}{(drop.quantity || 1) > 1 ? ` ×${drop.quantity}` : ''}
                                    <small>{rarityLabels[drop.rarity || 'normal']}</small>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {event.resultsSummary && (
                          <div className="summary-strip">
                            <span>สถิติรวม <b>{event.resultsSummary}</b></span>
                            {event.nextReset && <span>รีเซ็ตใน <b>{event.nextReset}</b></span>}
                          </div>
                        )}
                      </div>
                      {safeActivityPage === 1 && index === 0 && <span className="new-ribbon">ล่าสุด</span>}
                    </article>
                  );
                })}
                </div>
                {totalActivityPages > 1 && (
                  <nav className="pagination" aria-label="แบ่งหน้าประวัติการฟาร์ม">
                    <button disabled={safeActivityPage === 1} onClick={() => setActivityPage((page) => Math.max(1, page - 1))}>
                      ก่อนหน้า
                    </button>
                    <span>หน้า <b>{safeActivityPage}</b> จาก {totalActivityPages}</span>
                    <button disabled={safeActivityPage === totalActivityPages} onClick={() => setActivityPage((page) => Math.min(totalActivityPages, page + 1))}>
                      ถัดไป
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <footer>
        <span>ACX Farm Tracker</span>
        <span>Discord → Web Dashboard</span>
      </footer>
    </div>
  );
}
