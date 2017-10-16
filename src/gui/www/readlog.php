<?
    $value = file_get_contents('log.txt');
    echo iconv("GBK", "UTF-8", $value);
?>
