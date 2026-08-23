import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { COMPETENCIAS_PEDAGOGICAS } from '../constants/competencias';
import type { CompetenciaNombre } from '../constants/competencias';

export class PatronCompetenciaDto {
  @ApiPropertyOptional({ enum: COMPETENCIAS_PEDAGOGICAS })
  @IsIn(COMPETENCIAS_PEDAGOGICAS)
  competencia: CompetenciaNombre;

  @ApiPropertyOptional({
    description: 'Porcentaje de aciertos deseado para esta competencia (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  porcentajeAciertos: number;
}

export class SimularDto {
  @ApiPropertyOptional({
    description:
      'Patrón de aciertos por competencia. Si se omite, se usa el patrón por defecto (falla en matemática e indagación científica).',
    type: [PatronCompetenciaDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatronCompetenciaDto)
  patrones?: PatronCompetenciaDto[];
}
