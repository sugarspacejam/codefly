export type ParseStatus = 'full' | 'partial' | 'unsupported';

export interface GraphDefinition {
  name: string;
  line: number;
  kind: string;
}

export interface GraphNode {
  id: string;
  label: string;
  folder: string;
  lines: number;
  fullPath: string;
  definitions: GraphDefinition[];
  lang: string;
  preview: string[];
  rawPreview: string[];
  parseStatus: string;
  parseReason: string;
  size: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface SymbolEdge {
  fromFile: string;
  toFile: string;
  fromSymbol: string;
  toSymbol: string;
  fromKind: string;
  toKind: string;
  fromLine: number;
  toLine: number;
  callLine: number;
  type: 'static-call';
}

export interface GraphMeta {
  languages: Record<string, number>;
  parseSummary: Record<string, number>;
  unsupportedExtensions: string[];
  totalFiles: number;
  generatedAt: string;
  repo?: string;
  branch?: string;
  provider?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  symbolEdges: SymbolEdge[];
  meta: GraphMeta;
}
