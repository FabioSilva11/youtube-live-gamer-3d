'use client';
import { TreePine, Blocks, Users, Check, ArrowUpRight } from 'lucide-react';
import { BIOMES } from '@/lib/biomes';

const icons = { fantasy: TreePine, minecraft: Blocks };

export default function BiomeGallery({
  name,
  selected,
}: {
  name: string;
  selected: string;
}) {
  return (
    <main className="dash-main">
      <div className="gallery-heading">
        <span className="dash-eyebrow">SUA BIBLIOTECA DE MUNDOS</span>
        <h1>Qual vai ser o cenário de hoje?</h1>
        <p>
          Olá, {name.split(' ')[0]}. Escolha um bioma para abrir seu estúdio.
        </p>
      </div>
      <div className="gallery-meta">
        <h2>
          Meus biomas <span>{BIOMES.length}</span>
        </h2>
        <span>
          <Users size={16} />
          Sua comunidade, em qualquer ambiente
        </span>
      </div>
      <div className="biome-grid">
        {BIOMES.map((b) => {
          const Icon = icons[b.id];
          return (
            <article className="biome-card" key={b.id}>
              <div className="biome-cover">
                <img
                  src={b.image}
                  alt={'Captura real do bioma ' + b.name}
                  width={1440}
                  height={900}
                />
                {selected === b.id && (
                  <span className="biome-current">
                    <Check size={14} />
                    Último selecionado
                  </span>
                )}
              </div>
              <div className="biome-card-body">
                <span className="biome-kicker">
                  <Icon size={16} />
                  {b.type}
                </span>
                <h3>{b.name}</h3>
                <p>{b.description}</p>
                <div className="biome-tags">
                  {b.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <a className="dash-primary" href={'/studio/' + b.id}>
                  Abrir Estúdio
                  <ArrowUpRight size={18} />
                </a>
              </div>
            </article>
          );
        })}
      </div>
      <div className="gallery-footnote">
        <span>DOIS FORMATOS, O MESMO MUNDO</span>
        <p>
          No estúdio, escolha horizontal para sua live ou vertical para uma cena
          em 9:16. Seus participantes e eventos Pix acompanham o bioma.
        </p>
      </div>
    </main>
  );
}
