import Controls from "./components/Controls";

export default function Page() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold mb-4">TrackMyBird</h1>
      <p className="mb-6">Pick a live ICAO24 hex or enter one manually.</p>
      <Controls />
    </main>
  );
}
