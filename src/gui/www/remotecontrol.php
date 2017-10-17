<?
    try {
        $user = "your user name";
        $pwd  = "your password";
        $path = "your directory of caliper ";
        $host = "host's ip address"
        $port = 22;
        set_time_limit( 0);

        session_start();
        $_SESSION['started'] = true;
        session_write_close();

        $connect = ssh2_connect($host, $port);
        $hasReport = false;

        if(ssh2_auth_password($connect, $user, $pwd)){
            // start the benchmark
            $stream = ssh2_exec($connect, $path.'scripts/start.sh ' . $_GET['b'] . ' ' . $_GET['s']);
            stream_set_blocking($stream, true);
            // fetch the log file to get running result
            while($stream) {
                @session_start();
                if($_SESSION['started'] == false) {
                    echo "stopped";
                    exit();
                }
                session_write_close();

                sleep(1);
                $out = ssh2_exec($connect, 'cat '.$path.'output.log');
                stream_set_blocking($out, true);
                $result = stream_get_contents($out);
                $file = fopen("log.txt", "w");
                fwrite($file, $result);
                fclose($file);
                fclose($out);

                $demo = ssh2_exec($connect, 'cat '.$path.'src/gui/output/demo.json');
                stream_set_blocking($demo, true);
                $demoResult = stream_get_contents($demo);
                $demoFile = fopen("demo.json", "w");
                fwrite($demoFile, $demoResult);
                fclose($demoFile);
                if(!$hasReport) {
                    $json = json_decode($demoResult);
                    $report = $json->report;
                    if(strpos($report, '.html') !== false ) {
                        $html = ssh2_exec($connect, 'cat '.$report);
                        stream_set_blocking($html, true);
                        $htmlData = stream_get_contents($html);
                        $htmlFile = fopen("report.html", "w");
                        fwrite($htmlFile, $htmlData);
                        fclose($htmlFile);
                        fclose($html);
                        $hasReport = true;
                    }
                }
                fclose($demo);

                if(strpos($result, '# fail  ') !== false || strpos($result, '# ok') !== false) {
                    sleep(2);
                    break;
                }
            }

            stream_get_contents($stream);
            fclose($stream);

            if($hasReport) {
                echo "ok";
            }
            else {
                echo "finished";
            }
            exit();
        }
        else {
            echo "error";
            exit();
        }
    }
    catch(Exception $e) {
        echo "error";
        exit();
    }

?>
