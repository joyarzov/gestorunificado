<div class="ref-fecha">
    @foreach($props['items'] ?? [] as $item)
        <p>
            <strong>{{ $item['label'] ?? '' }}</strong>
            @isset($item['var']){{ $datos[$item['var']] ?? '' }}@endisset
            @isset($item['texto']){{ $item['texto'] }}@endisset
        </p>
    @endforeach
</div>
