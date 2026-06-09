<div class="parrafo {{ $props['align'] ?? 'left' }}"@isset($props['margin_top']) style="margin-top: {{ $props['margin_top'] }};"@endisset>
    @isset($props['var']){!! nl2br(e($datos[$props['var']] ?? '')) !!}@endisset
    @isset($props['texto']){!! $interp($props['texto']) !!}@endisset
</div>
