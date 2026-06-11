"""Lê o server/prisma/schema.prisma e gera um ERD em Graphviz, exportado em PDF."""
import re, subprocess, sys, pathlib

SCHEMA = pathlib.Path("/home/user/P016SGNC/server/prisma/schema.prisma").read_text()

# Remove blocos generator/datasource e comentários para simplificar o parse.
lines = SCHEMA.split("\n")

# Estado: encontrar `model X { ... }` e `enum Y { ... }`.
models = {}     # name -> list of dicts {name, type, pk, fk_target?, fk_field?, unique, optional, list}
enums = {}      # name -> [values]
relations = []  # list of (from_model, from_field, to_model, kind)  kind: '1:1' | '1:N' | 'N:M'

i = 0
while i < len(lines):
    line = lines[i].strip()
    m = re.match(r"^model\s+(\w+)\s*\{$", line)
    if m:
        name = m.group(1)
        body = []
        i += 1
        depth = 1
        while i < len(lines) and depth > 0:
            ln = lines[i]
            depth += ln.count("{") - ln.count("}")
            if depth > 0:
                body.append(ln)
            i += 1
        models[name] = body
        continue
    m = re.match(r"^enum\s+(\w+)\s*\{$", line)
    if m:
        name = m.group(1)
        values = []
        i += 1
        while i < len(lines) and lines[i].strip() != "}":
            v = lines[i].strip()
            if v and not v.startswith("//"):
                values.append(v)
            i += 1
        enums[name] = values
        i += 1
        continue
    i += 1

# Extrai campos. Linhas dentro do model são tipicamente "  fieldName Type modifiers..."
def parse_fields(model_name, body):
    fields = []
    relations_local = []  # (from_field, to_model, kind, fk_field)
    for raw in body:
        ln = raw.strip()
        if not ln or ln.startswith("//") or ln.startswith("@@"):
            continue
        # Suporta: name Type[modifiers]?
        m = re.match(r"^(\w+)\s+([\w\[\]?\.]+)(.*)$", ln)
        if not m:
            continue
        fname, ftype, rest = m.group(1), m.group(2), m.group(3)
        is_list = ftype.endswith("[]")
        optional = ftype.endswith("?")
        base_type = ftype.rstrip("[]?")
        is_pk = "@id" in rest
        is_unique = "@unique" in rest
        is_scalar_relation_target = base_type in ("String", "Int", "Boolean", "DateTime", "Json", "Decimal", "Float", "BigInt", "Bytes")
        # @relation(...) indica vínculo (lado FK ou lado pai)
        is_relation_link = "@relation" in rest

        # Se o tipo é um model conhecido e não é escalar, é uma relação.
        if base_type in models or (base_type in enums and False):
            # Detecta FK + target via @relation(fields: [fkField], references: [...])
            mrel = re.search(r"@relation\(\s*fields:\s*\[(\w+)\]\s*,\s*references:\s*\[(\w+)\]", rest)
            fk_field = mrel.group(1) if mrel else None
            kind = None
            if is_list:
                kind = "many"
            else:
                kind = "one"
            relations_local.append((fname, base_type, kind, optional, fk_field))
            fields.append({
                "name": fname,
                "type": base_type + ("[]" if is_list else "") + ("?" if optional else ""),
                "kind": "relation",
                "pk": False,
                "unique": False,
                "fk_field": fk_field,
            })
            continue

        # Campo escalar
        fields.append({
            "name": fname,
            "type": base_type + ("[]" if is_list else "") + ("?" if optional else ""),
            "kind": "scalar",
            "pk": is_pk,
            "unique": is_unique,
            "fk_field": None,
        })
    return fields, relations_local

parsed = {}
for name, body in models.items():
    parsed[name] = parse_fields(name, body)

# Constrói arestas. Vamos representar relações sem duplicar: para cada
# (from_model, to_model) pegamos a maior cardinalidade vista.
edges = {}  # (a,b) -> kind ('1:1','1:N','N:M')
for name, (fields, rels) in parsed.items():
    for fname, target, kind, optional, fk_field in rels:
        a, b = sorted([name, target])
        prev = edges.get((a, b))
        # Determina cardinalidade considerando ambos lados quando conseguirmos achar.
        # Aqui só registramos o lado atual; consolida depois.
        edges.setdefault((a, b), {"sides": [], "fk": None})
        edges[(a, b)]["sides"].append((name, target, kind, fk_field))
        if fk_field:
            edges[(a, b)]["fk"] = (name, fk_field)

def cardinality(sides):
    """Retorna '1:1', '1:N' ou 'N:M' baseado nos lados observados."""
    # Coleta apenas tipos: many / one
    kinds = sorted([s[2] for s in sides])
    if kinds == ["many", "many"]:
        return "N:M"
    if "many" in kinds and "one" in kinds:
        return "1:N"
    # ambos one — provavelmente 1:1 explícito
    return "1:1"

# Monta o DOT
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def model_to_label(name):
    fields, _ = parsed[name]
    pk = [f for f in fields if f["pk"]]
    scalars = [f for f in fields if f["kind"] == "scalar" and not f["pk"]]
    rels = [f for f in fields if f["kind"] == "relation"]
    rows = []
    rows.append(f'<TR><TD BGCOLOR="#1f2937" COLSPAN="2"><FONT COLOR="white" POINT-SIZE="13"><B>{esc(name)}</B></FONT></TD></TR>')
    for f in pk:
        rows.append(f'<TR><TD ALIGN="LEFT" PORT="{esc(f["name"])}"><FONT COLOR="#0ea5e9"><B>🔑 {esc(f["name"])}</B></FONT></TD><TD ALIGN="LEFT"><FONT COLOR="#475569">{esc(f["type"])}</FONT></TD></TR>')
    fk_field_names = {f["fk_field"] for f in rels if f["fk_field"]}
    for f in scalars:
        marks = []
        if f["unique"]:
            marks.append("U")
        is_fk = f["name"] in fk_field_names
        if is_fk:
            marks.append("FK")
        mark_html = (' <FONT COLOR="#dc2626"><B>['+",".join(marks)+']</B></FONT>') if marks else ''
        rows.append(f'<TR><TD ALIGN="LEFT" PORT="{esc(f["name"])}">{esc(f["name"])}{mark_html}</TD><TD ALIGN="LEFT"><FONT COLOR="#475569">{esc(f["type"])}</FONT></TD></TR>')
    if rels:
        rows.append('<TR><TD BGCOLOR="#f1f5f9" COLSPAN="2"><FONT POINT-SIZE="9" COLOR="#475569"><I>Relações</I></FONT></TD></TR>')
        for f in rels:
            rows.append(f'<TR><TD ALIGN="LEFT" PORT="rel_{esc(f["name"])}"><FONT COLOR="#0f766e">↔ {esc(f["name"])}</FONT></TD><TD ALIGN="LEFT"><FONT COLOR="#475569">{esc(f["type"])}</FONT></TD></TR>')
    table = '<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">' + "".join(rows) + "</TABLE>"
    return f"<{table}>"

dot = ["digraph ERD {"]
dot.append('  rankdir=LR;')
dot.append('  graph [bgcolor="white", pad="0.5", nodesep="0.6", ranksep="1.2", splines=spline, fontname="DejaVu Sans"];')
dot.append('  node [shape=plain, fontname="DejaVu Sans"];')
dot.append('  edge [color="#475569", fontname="DejaVu Sans", fontsize=9];')

# Título (legenda)
dot.append('  subgraph cluster_legend {')
dot.append('    label="P016SGNC — Modelo de Dados (gerado a partir de prisma/schema.prisma)";')
dot.append('    labeljust="l"; style=invis;')
dot.append('  }')

for name in parsed.keys():
    dot.append(f'  "{name}" [label={model_to_label(name)}];')

# Enums (caixas simples)
for ename, vals in enums.items():
    rows = [f'<TR><TD BGCOLOR="#7c3aed" COLSPAN="1"><FONT COLOR="white"><B>{esc(ename)} (enum)</B></FONT></TD></TR>']
    for v in vals:
        rows.append(f'<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="10">{esc(v)}</FONT></TD></TR>')
    table = '<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">' + "".join(rows) + "</TABLE>"
    dot.append(f'  "{ename}" [label=<{table}>];')

# Arestas (1 por par)
emitted = set()
for (a, b), info in edges.items():
    if (a, b) in emitted:
        continue
    kind = cardinality(info["sides"])
    if kind == "1:1":
        arrowhead, arrowtail = "tee", "tee"
    elif kind == "1:N":
        arrowhead, arrowtail = "crow", "tee"
    else:  # N:M
        arrowhead, arrowtail = "crow", "crow"
    label = kind
    dot.append(f'  "{a}" -> "{b}" [dir=both, arrowhead={arrowhead}, arrowtail={arrowtail}, label="{label}"];')
    emitted.add((a, b))

dot.append("}")
dot_text = "\n".join(dot)

dot_path = "/tmp/sgnc_erd.dot"
pathlib.Path(dot_path).write_text(dot_text)

# Renderiza PDF
pdf_path = "/home/user/P016SGNC/docs/sgnc_erd.pdf"
pathlib.Path(pdf_path).parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["dot", "-Tpdf", dot_path, "-o", pdf_path], check=True)
print(f"PDF gerado em: {pdf_path}")
print(f"Modelos: {len(parsed)}; Enums: {len(enums)}; Arestas: {len(edges)}")
