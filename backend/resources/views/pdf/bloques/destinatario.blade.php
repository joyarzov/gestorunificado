<div class="bloque" style="margin-bottom:18px;">
    <p style="margin:0;"><strong>{{ $props['label'] ?? 'A:' }}</strong> {{ $datos[$props['nombre_var'] ?? 'destinatario'] ?? '' }}</p>
    @isset($props['cargo_var'])@if(!empty($datos[$props['cargo_var']]))<p style="margin:2px 0 0 0;">{{ $datos[$props['cargo_var']] }}</p>@endif @endisset
    @isset($props['institucion_var'])@if(!empty($datos[$props['institucion_var']]))<p style="margin:2px 0 0 0;">{{ $datos[$props['institucion_var']] }}</p>@endif @endisset
    @if($props['presente'] ?? false)<p style="margin:5px 0 0 0;"><strong>PRESENTE</strong></p>@endif
</div>
