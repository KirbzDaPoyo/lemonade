import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Keyboard, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { V2Button, V2TextField } from '../components/v2-controls';
import { V2SectionLabel, V2TopBar } from '../components/v2-layout';
import { MapButtons } from '../components/map-buttons';
import { useAppTheme } from '../design-system/theme';
import type { AppNavigation } from '../navigation/types';
import { usePlans } from '../store/plans-context';
import { usePlaces } from '../store/PlacesContext';
import { membershipFeedback, normalizePlanTitle, pickPlanPlace, planPlaces, type DiningPlan } from '../types/dining-plan';
import { defaultLibraryView, selectLibraryPlaces } from '../services/library-view';
import { statusLabels } from '../utils/labels';
import { analytics } from '../observability/analytics';
// Random identity is only an idempotency key, never an authentication secret.
const newPlanId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
export function PlansScreen({ navigation, planId, addPlaceId }: {
    navigation: AppNavigation;
    planId?: string;
    addPlaceId?: string;
}) {
    const state = usePlans();
    const library = usePlaces();
    const { theme } = useAppTheme();
    const [title, setTitle] = useState('');
    const [editing, setEditing] = useState(false);
    const [query, setQuery] = useState('');
    const [picking, setPicking] = useState(false);
    const [resultId, setResultId] = useState<string>();
    const [includeSkipped, setIncludeSkipped] = useState(false);
    const [notice, setNotice] = useState<string>();
    const createId = useRef<string>('');
    if (!createId.current)
        createId.current = newPlanId();
    const searchResults = useMemo(() => selectLibraryPlaces(library.places, { ...defaultLibraryView, query }), [library.places, query]);
    const plan = state.plans.find(p => p.id === planId);
    const members = plan ? planPlaces(plan, library.places) : [];
    const result = members.find(p => p.id === resultId && (includeSkipped || p.status !== 'skipped'));
    const selectedPlace = library.places.find(p => p.id === addPlaceId);
    const dirty = editing && title !== (plan?.title ?? '');
    useFocusEffect(useCallback(() => { void state.refresh(); }, [state.refresh]));
    useEffect(() => { setResultId(undefined); setIncludeSkipped(false); setPicking(false); setEditing(false); setTitle(''); }, [planId]);
    const leave = () => { if (Keyboard.isVisible()) {
        Keyboard.dismiss();
        return;
    } if (picking) {
        setPicking(false);
        return;
    } if (dirty) {
        Alert.alert('Discard title changes?', 'Your saved plan will stay unchanged.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { setEditing(false); navigation.goBack(); } }]);
        return;
    } navigation.goBack(); };
    useFocusEffect(useCallback(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; }); return () => sub.remove(); }, [picking, dirty, navigation, title]));
    const textStyle = { color: theme.colors.text, fontSize: 16 };
    const section = { gap: 12, paddingVertical: 18, borderBottomWidth: 1, borderColor: theme.colors.border };
    const openPlace = (id: string) => navigation.navigate({ name: 'PlaceDetail', placeId: id });
    const saveTitle = async () => {
        let normalized: string;
        try {
            normalized = normalizePlanTitle(title);
        }
        catch (e) {
            setNotice((e as Error).message);
            return;
        }
        const ok = await state.mutate(repo => plan ? repo.update(plan.id, { title: normalized }) : repo.create(normalized, createId.current));
        if (ok) {
            if (!plan)
                analytics.planAction('created');
            createId.current = newPlanId();
            setEditing(false);
            setTitle('');
            setNotice('Plan saved.');
        }
    };
    const add = async (target: DiningPlan, id: string) => { const feedback = membershipFeedback(target, id); if (feedback) {
        setNotice(feedback);
        return;
    } if (await state.mutate(repo => repo.add(target.id, id))) {
        analytics.planAction('place_added');
        setNotice('Place added to plan.');
    } };
    const transition = async () => { if (!plan)
        return; const status = plan.status === 'active' ? 'completed' : 'active'; if (await state.mutate(repo => repo.update(plan.id, { status })))
        analytics.planAction(status === 'active' ? 'reopened' : 'completed'); };
    const removePlan = () => { if (!plan)
        return; Alert.alert('Delete this plan?', 'Saved places will remain in your library.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete plan', style: 'destructive', onPress: () => { void state.mutate(repo => repo.remove(plan.id)).then(ok => { if (ok)
                navigation.goBack(); }); } }]); };
    const pick = () => { const picked = pickPlanPlace(members, includeSkipped); setResultId(picked?.id); setNotice(!members.length ? 'Add places to your shortlist first.' : !picked ? 'All places are skipped. Include skipped places to choose one.' : undefined); analytics.planAction('picker_used'); };
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}><ScrollView contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: 18, paddingBottom: 48 }}>
  <V2TopBar onBack={leave}/>
  <Text accessibilityRole="header" selectable style={{ ...textStyle, fontFamily: theme.typography.displayFamily, fontSize: 36 }}>{planId ? plan?.title ?? 'OUTING PLAN' : 'YOUR PLANS'}</Text>
  {state.loading ? <ActivityIndicator accessibilityLabel="Loading plans" color={theme.colors.text}/> : null}
  {state.error ? <View style={section}><Text accessibilityRole="alert" selectable style={textStyle}>{state.error} Your last confirmed shortlist remains available.</Text><V2Button label="Refresh plans" disabled={state.busy} onPress={() => void state.refresh()}/></View> : null}
  {notice ? <Text accessibilityLiveRegion="polite" selectable style={textStyle}>{notice}</Text> : null}
  {library.storageError ? <View style={section}><Text style={textStyle}>Saved places could not be refreshed.</Text><V2Button label="Retry library" onPress={() => void library.retryStorage()}/></View> : null}
  {editing ? <View style={section}><V2TextField label="Plan title" hint={`${Array.from(title.trim()).length} / 80 characters`} value={title} onChangeText={setTitle} editable={!state.busy} autoFocus multiline/><V2Button label={state.busy ? 'Saving…' : 'Save title'} disabled={state.busy} onPress={() => void saveTitle()}/><V2Button variant="ghost" label="Cancel title edit" disabled={state.busy} onPress={() => { if (dirty)
        Alert.alert('Discard title changes?', 'Your saved plan remains unchanged.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', onPress: () => setEditing(false) }]);
    else
        setEditing(false); }}/></View> : null}
  {!planId ? <>
   <Text style={textStyle}>{addPlaceId ? selectedPlace ? `Choose a plan for ${selectedPlace.placeName}.` : 'This saved place is unavailable. Return to your library.' : 'Private shortlists for your next meal. Completing a plan keeps every saved place unchanged.'}</Text>
   {!editing ? <V2Button label="Create plan" disabled={state.busy} onPress={() => { setTitle(''); setEditing(true); }}/> : null}
   {!state.loading && !state.error && !state.plans.length ? <Text style={textStyle}>No plans yet. Create a plan and add up to 20 saved places.</Text> : null}
   {(['active', 'completed'] as const).map(status => <View key={status} style={section}><V2SectionLabel>{status === 'active' ? 'Active plans' : 'Completed plans'}</V2SectionLabel>{state.plans.filter(p => p.status === status).map(p => <View key={p.id} style={section}><Text selectable style={textStyle}>{p.title} · {p.status} · {p.placeIds.length} / 20 places</Text><V2Button variant="secondary" label={`Open ${p.title}`} onPress={() => navigation.navigate({ name: 'PlanDetail', planId: p.id })}/>{selectedPlace ? <V2Button label={membershipFeedback(p, selectedPlace.id) ?? 'Add to this plan'} disabled={state.busy || !!membershipFeedback(p, selectedPlace.id)} onPress={() => void add(p, selectedPlace.id)}/> : null}</View>)}</View>)}
  </> : plan ? <>
   <Text accessibilityLabel={`Plan ${plan.status}, ${members.length} saved places`} style={textStyle}>{plan.status === 'active' ? 'Active shortlist' : 'Completed plan'} · {members.length} / 20 places</Text>
   {plan.placeIds.length > members.length && !library.isLoading ? <Text accessibilityRole="alert" style={textStyle}>Some places are no longer available in your library. Refresh plans and the library to reconcile changes.</Text> : null}
   <V2Button variant="secondary" label="Rename plan" disabled={state.busy} onPress={() => { setTitle(plan.title); setEditing(true); }}/>
   <V2Button variant="secondary" label={plan.status === 'active' ? 'Complete plan' : 'Reopen plan'} disabled={state.busy} onPress={() => void transition()}/>
   <Text style={textStyle}>Completing this shortlist does not mark places visited.</Text>
   <V2Button label={plan.placeIds.length >= 20 ? 'Plan full · 20 places' : 'Add saved places'} disabled={state.busy || plan.placeIds.length >= 20} onPress={() => setPicking(v => !v)}/>
   {picking ? <View style={section}><V2TextField label="Search your library" value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" onSubmitEditing={Keyboard.dismiss}/><V2Button variant="ghost" label="Close place picker" onPress={() => setPicking(false)}/>{searchResults.map(p => <View key={p.id} style={section}><Text style={textStyle}>{p.placeName} · {p.areaCity} · {statusLabels[p.status]}</Text><V2Button label={membershipFeedback(plan, p.id) ?? `Add ${p.placeName}`} disabled={state.busy || !!membershipFeedback(plan, p.id)} onPress={() => void add(plan, p.id)}/></View>)}{!searchResults.length ? <Text style={textStyle}>{library.isLoading ? 'Loading saved places…' : 'No matching saved places.'}</Text> : null}</View> : null}
   <View style={section}><V2SectionLabel>Pick for me</V2SectionLabel><Text style={textStyle}>A random choice from this shortlist. Skipped places are excluded by default.</Text><V2Button variant="secondary" selected={includeSkipped} label={includeSkipped ? 'Skipped places included · exclude' : 'Include skipped places'} onPress={() => { setIncludeSkipped(v => !v); setResultId(undefined); }}/><V2Button label="Pick for me" onPress={pick}/>
    {result ? <View style={section}><Text accessibilityLiveRegion="polite" style={textStyle}>{members.filter(p => includeSkipped || p.status !== 'skipped').length === 1 ? 'Only eligible place: ' : 'Random pick: '}{result.placeName}</Text><V2Button label="Open picked place" onPress={() => openPlace(result.id)}/><MapButtons place={result}/><V2Button label="Pick again" onPress={pick}/><V2Button variant="ghost" label="Dismiss result" onPress={() => setResultId(undefined)}/></View> : null}
   </View>
   {!members.length ? <Text style={textStyle}>Your shortlist is empty. Add saved places to compare them here.</Text> : null}
   {members.map(p => <View key={p.id} style={section}><Text selectable accessibilityRole="header" style={{ ...textStyle, fontSize: 24 }}>{p.placeName}</Text><Text style={textStyle}>{[p.areaCity, p.category, p.cuisineOrSpecialty].filter(Boolean).join(' · ')}</Text><Text style={textStyle}>{statusLabels[p.status]}{p.isFavorite ? ' · Favorite' : ''}</Text>{p.tags.length ? <Text style={textStyle}>Tags: {p.tags.join(', ')}</Text> : null}{p.notes ? <Text style={textStyle}>Has your notes</Text> : null}<V2Button variant="secondary" label={`Open ${p.placeName}`} onPress={() => openPlace(p.id)}/><MapButtons place={p}/><V2Button variant="ghost" label={`Remove ${p.placeName} from plan`} disabled={state.busy} onPress={() => { void state.mutate(repo => repo.removePlace(plan.id, p.id)).then(ok => { if (ok) {
            analytics.planAction('place_removed');
            setNotice('Removed from plan. The saved place remains in your library.');
        } }); }}/></View>)}
   <View style={section}><V2SectionLabel color="pink">Delete plan</V2SectionLabel><V2Button variant="danger" label="Delete plan" disabled={state.busy} onPress={removePlan}/></View>
  </> : !state.loading && !state.error ? <Text style={textStyle}>This plan was removed or is unavailable to this account.</Text> : null}

 </ScrollView></SafeAreaView>;
}
