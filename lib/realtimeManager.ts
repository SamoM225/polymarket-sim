'use client';

import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

interface SubscriptionConfig<T> {
  table: string;
  filter?: string;
  onInsert?: (data: T) => void;
  onUpdate?: (data: T) => void;
  onDelete?: (data: T) => void;
  onError?: (error: Error) => void;
}

// Spravuje Supabase realtime subscriptions s auto-reconnect
export class RealtimeManager {
  private subscriptions = new Map<string, RealtimeChannel>();
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
  private configs = new Map<string, SubscriptionConfig<any>>();
  private lastResubscribeAt = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', this.handleReconnectEvent);
      window.addEventListener('focus', this.handleReconnectEvent);
      window.addEventListener('online', this.handleReconnectEvent);
    }
  }

  // Subscribne na table s INSERT/UPDATE/DELETE eventmi
  subscribe<T>(
    channelName: string,
    config: SubscriptionConfig<T>,
    skipUnsubscribe = false
  ): () => Promise<void> {
    if (!skipUnsubscribe) {
      this.unsubscribe(channelName, true);
    }
    this.configs.set(channelName, config);

    let channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: channelName },
      },
    });

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: config.table,
          filter: config.filter,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (config.onInsert) {
            config.onInsert(payload.new as T);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: config.table,
          filter: config.filter,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (config.onUpdate) {
            config.onUpdate(payload.new as T);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: config.table,
          filter: config.filter,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (config.onDelete) {
            config.onDelete(payload.old as T);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          this.clearReconnectTimer(channelName);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for ${channelName}:`, err);
          if (config.onError) {
            config.onError(new Error(`Channel error: ${err?.message}`));
          }
          this.scheduleReconnect(channelName, config);
        } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
          console.warn(`⚠️ Connection closed/timeout for ${channelName}`);
          this.scheduleReconnect(channelName, config);
        }
      });

    this.subscriptions.set(channelName, channel);

    return async () => {
      await this.unsubscribe(channelName);
    };
  }

  private async unsubscribe(channelName: string, preserveConfig = false): Promise<void> {
    const channel = this.subscriptions.get(channelName);
    if (channel) {
      await channel.unsubscribe();
      this.subscriptions.delete(channelName);
    }
    this.clearReconnectTimer(channelName);
    if (!preserveConfig) {
      this.configs.delete(channelName);
    }
  }

  private scheduleReconnect<T>(
    channelName: string,
    config: SubscriptionConfig<T>,
    attempt = 1
  ): void {
    if (attempt > this.maxRetries) {
      console.error(`❌ Max retries reached for ${channelName}`);
      return;
    }

    const delay = this.retryDelay * Math.pow(2, attempt - 1);

    const timer = setTimeout(() => {
      void this.resubscribeChannel(channelName, config);
      this.reconnectTimers.delete(channelName);
    }, delay);

    this.reconnectTimers.set(channelName, timer);
  }

  private clearReconnectTimer(channelName: string): void {
    const timer = this.reconnectTimers.get(channelName);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(channelName);
    }
  }

  private handleReconnectEvent = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    const now = Date.now();
    if (now - this.lastResubscribeAt < 1000) {
      return;
    }
    this.lastResubscribeAt = now;
    void this.resubscribeAll();
  };

  private async resubscribeAll(): Promise<void> {
    const entries = Array.from(this.configs.entries());
    for (const [channelName, config] of entries) {
      await this.resubscribeChannel(channelName, config);
    }
  }

  private async resubscribeChannel<T>(
    channelName: string,
    config: SubscriptionConfig<T>
  ): Promise<void> {
    await this.unsubscribe(channelName, true);
    this.subscribe(channelName, config, true);
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  async cleanup(): Promise<void> {
    const channelNames = Array.from(this.subscriptions.keys());
    for (const name of channelNames) {
      await this.unsubscribe(name);
    }
  }
}

export const realtimeManager = new RealtimeManager();
