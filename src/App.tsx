import { useEffect, useState } from 'react';
import { geometry } from './geometry/client';
import { DEFAULT_DESIGN } from './state/schema';

export function App() {
  const [msg, setMsg] = useState('loading');
  useEffect(() => {
    (async () => {
      const g = geometry();
      const init = await g.init();
      const res = await g.build(1, DEFAULT_DESIGN);
      setMsg(`${init}; tris=${res.stats.triangles}; watertight=${res.stats.watertight}`);
    })().catch((e: unknown) => setMsg(`error: ${String(e)}`));
  }, []);
  return <pre id="m0">{msg}</pre>;
}
