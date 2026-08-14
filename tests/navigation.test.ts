import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  initialImportFlowState,
  reduceImportFlow
} from '../src/navigation/import-flow-context';
import {
  appRoutePaths,
  getPlaceDetailHref
} from '../src/navigation/route-contract';

test('Expo Router is the application entry point with every 0.2-C route', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    main?: string;
  };
  const routeFiles = [
    'app/_layout.tsx',
    'app/(auth)/sign-in.tsx',
    'app/(app)/index.tsx',
    'app/(app)/account.tsx',
    'app/(app)/add-place.tsx',
    'app/(app)/match-place.tsx',
    'app/(app)/place/[placeId].tsx'
  ];

  assert.equal(packageJson.main, 'expo-router/entry');
  routeFiles.forEach((routeFile) => assert.equal(existsSync(routeFile), true));
  assert.equal(existsSync('src/navigation/AppNavigator.tsx'), false);
});

test('authentication groups are protected by Clerk session state', () => {
  const rootLayout = readFileSync('app/_layout.tsx', 'utf8');

  assert.match(rootLayout, /Stack\.Protected guard=\{Boolean\(isSignedIn\)\}/);
  assert.match(rootLayout, /Stack\.Protected guard=\{!isSignedIn\}/);
  assert.match(rootLayout, /<Stack\.Screen name="\(app\)"/);
  assert.match(rootLayout, /<Stack\.Screen name="\(auth\)"/);
});

test('transient import state clears between shared and manual add flows', () => {
  const sharedUrl = 'https://www.instagram.com/reel/shared/';
  const sharedState = reduceImportFlow(initialImportFlowState, {
    type: 'begin-share',
    instagramUrl: sharedUrl
  });
  const draft = { sourceInstagramUrl: sharedUrl };
  const candidateState = reduceImportFlow(sharedState, {
    type: 'show-candidates',
    draft,
    candidates: []
  });
  const manualState = reduceImportFlow(candidateState, {
    type: 'begin-manual'
  });

  assert.equal(sharedState.initialInstagramUrl, sharedUrl);
  assert.equal(candidateState.draft, draft);
  assert.deepEqual(candidateState.candidates, []);
  assert.equal(manualState.initialInstagramUrl, undefined);
  assert.equal(manualState.draft, undefined);
  assert.deepEqual(manualState.candidates, []);
  assert.equal(manualState.requestId, sharedState.requestId + 1);
});

test('external HTTPS links open directly without an Android capability preflight', () => {
  const detailScreen = readFileSync('src/screens/v2-place-detail-screen.tsx', 'utf8');

  assert.match(detailScreen, /await Linking\.openURL\(url\)/);
  assert.doesNotMatch(detailScreen, /Linking\.canOpenURL/);
});

test('only durable place IDs are encoded in route parameters', () => {
  assert.deepEqual(getPlaceDetailHref('place-123'), {
    pathname: '/place/[placeId]',
    params: { placeId: 'place-123' }
  });
  assert.equal(appRoutePaths.addPlace, '/add-place');
  assert.equal(appRoutePaths.matchPlace, '/match-place');

  const matchRoute = readFileSync('app/(app)/match-place.tsx', 'utf8');
  assert.match(matchRoute, /useImportFlow/);
  assert.doesNotMatch(matchRoute, /useLocalSearchParams/);
});
