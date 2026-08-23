import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ResponderDto {
  @ApiProperty({ description: 'Id de la pregunta respondida' })
  @IsString()
  @IsNotEmpty()
  preguntaId: string;

  @ApiProperty({ description: 'Alternativa elegida', enum: ['A', 'B', 'C'] })
  @IsIn(['A', 'B', 'C'])
  alternativaElegida: string;
}
