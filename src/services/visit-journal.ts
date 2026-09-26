import { VisitStorageError, type VisitRepository } from '../repositories/visits/visits-repository';
import type { Visit, VisitCursor, VisitDraft, VisitPage } from '../types/visit';

export type JournalState = {
  page: VisitPage | null; loading: boolean; busy: boolean; error: string | null;
  mutationError: string | null; notice: string | null; pageNumber: number;
};
const empty = (): JournalState => ({ page: null, loading: false, busy: false, error: null, mutationError: null, notice: null, pageNumber: 1 });

// Memory only. Destroying an account session invalidates every outstanding operation.
export class VisitAccountSession {
  active = true;
  generation = 0;
  dataRevision = 0;
  guard() {
    const generation = this.generation, revision = this.dataRevision;
    return () => { if ([...this.journals].some(journal => journal.state.busy) || !this.active || this.generation !== generation || this.dataRevision !== revision) throw new VisitStorageError('Your account or journal changed. Please retry.'); };
  }
  async summaries(placeIds: readonly string[]) {
    const guard = this.guard(); guard();
    if (!this.repository?.summaries) throw new VisitStorageError('Private visit storage is not configured.');
    const result = await this.repository.summaries(placeIds, guard); guard(); return result;
  }
  async exportAll() {
    const guard = this.guard(); guard();
    if (!this.repository?.exportAll) throw new VisitStorageError('Private visit storage is not configured.');
    const result = await this.repository.exportAll(guard); guard(); return result;
  }
  private journals = new Set<VisitJournal>();
  constructor(readonly repository?: VisitRepository) {}
  register(journal: VisitJournal) { this.journals.add(journal); }
  unregister(journal: VisitJournal) { this.journals.delete(journal); }
  clear() { this.active = false; this.generation++; for (const journal of this.journals) journal.dispose(); this.journals.clear(); }
}

export class VisitJournal {
  state = empty();
  private active = true;
  private revision = 0;
  private listeners = new Set<() => void>();
  private pendingTrail: Array<VisitCursor | undefined> | null = null;
  private trail: Array<VisitCursor | undefined> = [undefined];
  constructor(private account: VisitAccountSession, readonly placeId: string,
    private onPage: (page: VisitPage) => void = () => {},
    private onWrite: () => void = () => {}, private onFailure: () => void = () => {}) {
    account.register(this);
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private publish(patch: Partial<JournalState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  private current(revision: number) { return this.active && this.account.active && revision === this.revision; }
  dispose() { this.active = false; this.revision++; this.state = empty(); for (const listener of this.listeners) listener(); this.listeners.clear(); this.account.unregister(this); }
  private async read(trail: Array<VisitCursor | undefined>): Promise<boolean> {
    if (!this.active || !this.account.active) return false;
    const revision = ++this.revision;
    this.pendingTrail = trail;
    this.publish({ loading: true, error: null });
    try {
      if (!this.account.repository) throw new VisitStorageError('Private visit storage is not configured.');
      const page = await this.account.repository.history(this.placeId, trail.at(-1));
      if (!this.current(revision)) return false;
      this.trail = trail; this.pendingTrail = null;
      this.publish({ page, loading: false, error: null, mutationError: null, notice: null, pageNumber: trail.length });
      this.onPage(page);
      return true;
    } catch (error) {
      if (this.current(revision)) {
        this.publish({ loading: false, error: error instanceof VisitStorageError ? error.message : 'Visit history could not be loaded. Check your connection and retry.' });
        this.onFailure();
      }
      return false;
    }
  }
  refresh() { return this.state.busy ? Promise.resolve(false) : this.read([undefined]); }
  retryPage() { return this.state.busy ? Promise.resolve(false) : this.read(this.pendingTrail ?? this.trail); }
  older() {
    const page = this.state.page;
    if (this.state.busy || this.state.loading || !page?.hasMore || !page.entries.length) return Promise.resolve(false);
    const last = page.entries[page.entries.length - 1];
    return this.read([...this.trail, { visitDate: last.visitDate, createdAt: last.createdAt, id: last.id }]);
  }
  newer() { return this.state.busy || this.state.loading || this.trail.length < 2 ? Promise.resolve(false) : this.read(this.trail.slice(0, -1)); }
  private async mutate(action: (repo: VisitRepository) => Promise<unknown>, refreshPlace = false): Promise<boolean> {
    if (!this.active || !this.account.active || this.state.busy) return false;
    const revision = ++this.revision;
    this.publish({ busy: true, loading: false, mutationError: null, notice: null });
    this.account.dataRevision++;
    let confirmed = false;
    try {
      if (!this.account.repository) throw new VisitStorageError('Private visit storage is not configured.');
      await action(this.account.repository);
      if (!this.current(revision)) return false;
      confirmed = true;
      this.publish({ page: null });
      const refreshed = await this.read([undefined]);
      if (!this.active || !this.account.active) return false;
      if (!refreshed && refreshPlace) this.onWrite();
      if (!refreshed) this.publish({ notice: 'Your change was saved. Refresh history to see the latest visits and place status.' });
      return true;
    } catch (error) {
      if (this.current(revision)) {
        if (refreshPlace) this.onWrite();
        // A network failure may follow a committed write. Never show obsolete totals.
        this.publish({ page: null, mutationError: error instanceof VisitStorageError ? error.message : 'The change could not be confirmed. Check your connection and retry.' });
        this.onFailure();
      }
      return false;
    } finally {
      this.account.dataRevision++;
      if (this.active && this.account.active && (confirmed || this.current(revision))) this.publish({ busy: false });
    }
  }
  save(draft: VisitDraft, zone: string, original?: Visit) { return this.mutate(repo => repo.save(this.placeId, draft, zone, original), !original); }
  remove(id: string) { return this.mutate(repo => repo.remove(this.placeId, id)); }
}
