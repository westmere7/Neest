import { useState, type ReactNode } from 'react';
import { ChevronRight, Droplets, Lightbulb, MapPin, PawPrint, Ruler, Sprout, Thermometer, Waves } from 'lucide-react';
import type { LengthUnit } from '@/domain/model/schema';
import type { PlantInfo } from '@/data/assets/types';
import {
  PLANT_DIFFICULTY_LABELS,
  PLANT_GROWTH_LABELS,
  PLANT_HUMIDITY_LABELS,
  plantLightText,
  plantLowest,
  plantSizeRange,
  plantTempShort,
  plantWaterShort,
} from '@/data/assets/plantInfo';
import './plantCare.css';

/**
 * A plant's care guide, kept short: botanical name, badges (light, pets, difficulty) and one line
 * each for where to put it, water, temperature, humidity and mature size. With `details` (the Inspector)
 * a "More care details" toggle reveals the rest: warning signs, what to avoid, soil, repotting,
 * feeding, pets and a tip.
 */
export function PlantCare({ plant, units, details = false, className }: { plant: PlantInfo; units: LengthUnit; details?: boolean; className?: string }) {
  const p = plant;
  const [open, setOpen] = useState(false);
  return (
    <section className={`plant-care${className ? ` ${className}` : ''}`} aria-label="Plant care" data-testid="plant-care">
      <div className="pc-head">
        <em className="pc-botanical">{p.botanical}</em>
        <span className="pc-family">{p.family}</span>
      </div>
      <ul className="pc-badges">
        <li className="pc-badge">{plantLightText(p.light)}</li>
        <li className={`pc-badge pets ${p.pets.safe ? 'safe' : 'toxic'}`}>
          <PawPrint size={11} aria-hidden /> {p.pets.safe ? 'Pet safe' : 'Toxic to pets'}
        </li>
        <li className={`pc-badge level-${p.difficulty}`}>{PLANT_DIFFICULTY_LABELS[p.difficulty]}</li>
      </ul>
      <dl className="pc-rows">
        <Row icon={<MapPin size={12} />} label="Spot" title={`${p.spot}. ${p.rooms.join(', ')}.`}>
          <span className="pc-clamp">{p.spot}</span>
        </Row>
        <Row icon={<Droplets size={12} />} label="Water">
          {plantWaterShort(p)}
        </Row>
        <Row icon={<Thermometer size={12} />} label="Temp">
          <span className="num">{plantTempShort(p.temperature, units)}</span>
        </Row>
        <Row icon={<Waves size={12} />} label="Humidity">
          {PLANT_HUMIDITY_LABELS[p.humidity.level]}
        </Row>
        {p.form && p.form !== 'living' ? (
          <Row icon={<Ruler size={12} />} label="Lasts">
            {p.vaseLife} · {FORM_LABELS[p.form]}
          </Row>
        ) : (
          <Row icon={<Ruler size={12} />} label="Grows to">
            <span className="num">{plantSizeRange(p.height, units)} tall</span> · {PLANT_GROWTH_LABELS[p.growth].toLowerCase()}
          </Row>
        )}
      </dl>
      {details && (
        <>
          <button type="button" className={`pc-more${open ? ' open' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
            <ChevronRight size={12} aria-hidden /> More care details
          </button>
          {open && (
            <dl className="pc-details">
              <Detail label="When to water">{p.water.sign}</Detail>
              <Detail label="Rooms">{p.rooms.join(' · ')}</Detail>
              <Detail label="Avoid">{p.avoid}</Detail>
              <Detail label="Humidity">{p.humidity.note}</Detail>
              <Detail label="Temperature">{plantLowest(p.temperature, units)}</Detail>
              <Detail label="Soil">{p.soil}</Detail>
              <Detail label="Repot">{p.repot}</Detail>
              <Detail label="Feed">{p.feed}</Detail>
              <Detail label="Cats & dogs">{p.pets.note}</Detail>
              {p.aka && <Detail label="Also called">{p.aka}</Detail>}
              {p.tip && (
                <p className="pc-tip">
                  <Lightbulb size={12} aria-hidden />
                  <span>{p.tip}</span>
                </p>
              )}
            </dl>
          )}
        </>
      )}
    </section>
  );
}

const FORM_LABELS: Record<'cut' | 'dried' | 'preserved', string> = { cut: 'cut stems', dried: 'dried stems', preserved: 'preserved, no care' };

function Row({ icon, label, title, children }: { icon: ReactNode; label: string; title?: string; children: ReactNode }) {
  return (
    <>
      <dt>
        <span className="pc-icon" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd title={title}>{children}</dd>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pc-detail">
      <dt>
        <Sprout size={11} aria-hidden className="pc-icon" />
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
