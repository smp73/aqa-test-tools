import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useLocation } from 'react-router-dom';
import { Tooltip, Card, Alert } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import TestBreadcrumb from './TestBreadcrumb';
import { fetchData } from '../utils/Utils';
import { getParams, params } from '../utils/query';

const ReleaseSummary = () => {
    const [body, setBody] = useState('Generating Release Summary Report...');
    const location = useLocation();
    const { parentId, buildName } = getParams(location.search);

    useEffect(() => {
        const updateData = async () => {
            const { parentId } = getParams(location.search);
            const originUrl = window.location.origin;

            const build = await fetchData(`/api/getParents?id=${parentId}`);

            let report = '';
            const nl = `\n`;
            if (build && build[0]) {
                const { buildName, buildUrl, timestamp, startBy } = build[0];
                report =
                    `#### Release Summary Report for ${buildName} ${nl}` +
                    `**Report generated at:** ${new Date().toUTCString()} ${nl} ${nl}` +
                    `TRSS [Build](${originUrl}/buildDetail?parentId=${parentId}&testSummaryResult=failed&buildNameRegex=%5ETest) ` +
                    `and TRSS [Grid View](${originUrl}/resultSummary?parentId=${parentId}) ${nl}` +
                    `Jenkins Build URL ${buildUrl} ${nl}Started by ${startBy} at ${new Date(
                        timestamp
                    ).toLocaleString()} ${nl}`;

                report += `${nl} --- ${nl}`;

                const buildResult = '!SUCCESS';
                const failedBuilds = await fetchData(
                    `/api/getAllChildBuilds${params({ buildResult, parentId })}`
                );
                let failedBuildSummary = {};
                let failedTestSummary = {};
                await Promise.all(
                    failedBuilds.map(
                        async ({
                            _id,
                            buildName,
                            buildUrl,
                            buildResult,
                            javaVersion,
                            tests = [],
                            rerunLink,
                            rerunFailedLink,
                        }) => {
                            const buildInfo = `${nl}[**${buildName}**](${buildUrl})`;
                            const buildResultStr =
                                buildResult === 'UNSTABLE'
                                    ? ` ⚠️ ${buildResult} ⚠️${nl}`
                                    : ` ❌ ${buildResult} ❌${nl}`;

                            if (buildName.startsWith('Test_openjdk')) {
                                let rerunLinkInfo = '';
                                if (rerunFailedLink) {
                                    rerunLinkInfo = `Rerun [failed](${rerunFailedLink})${nl}`;
                                } else if (rerunLink) {
                                    rerunLinkInfo = `Rerun [all](${rerunLink})${nl}`;
                                }
                                failedTestSummary[buildName] = buildInfo;
                                failedTestSummary[buildName] += buildResultStr;

                                if (!buildName.includes('_testList')) {
                                    failedTestSummary[buildName] +=
                                        rerunLinkInfo;
                                    if (javaVersion) {
                                        const javaVersionBlock = `\`\`\`${nl}${javaVersion}${nl}\`\`\``;
                                        failedTestSummary[
                                            buildName
                                        ] += `<details><summary>java -version</summary>${nl}${nl}${javaVersionBlock}${nl}</details>${nl}${nl}`;
                                    }
                                }

                                if (buildName.includes('_rerun')) {
                                    failedTestSummary[
                                        buildName
                                    ] += `<details><summary>Failures in the rerun test build</summary>${nl}${nl}`;
                                }
                                const buildId = _id;
                                await Promise.all(
                                    tests.map(
                                        async ({
                                            _id,
                                            testName,
                                            testResult,
                                        }) => {
                                            const testId = _id;
                                            if (testResult === 'FAILED') {
                                                if (
                                                    buildName.includes('_rerun')
                                                ) {
                                                    failedTestSummary[
                                                        buildName
                                                    ] += `[${testName}](${originUrl}/output/test?id=${testId}) ${nl}`;
                                                } else {
                                                    const history =
                                                        await fetchData(
                                                            `/api/getHistoryPerTest?testId=${testId}&limit=100`
                                                        );
                                                    let totalPasses = 0;
                                                    for (let testRun of history) {
                                                        if (
                                                            testRun.tests
                                                                .testResult ===
                                                            'PASSED'
                                                        ) {
                                                            totalPasses += 1;
                                                        }
                                                    }
                                                    //For failed tests, add links to the deep history and possible issues list
                                                    failedTestSummary[
                                                        buildName
                                                    ] +=
                                                        `[${testName}](${originUrl}/output/test?id=${testId}) => [deep history ${totalPasses}/${history.length} passed](${originUrl}/deepHistory?testId=${testId}) | ` +
                                                        `[possible issues](${originUrl}/possibleIssues${params(
                                                            {
                                                                buildId,
                                                                buildName,
                                                                testId,
                                                                testName,
                                                            }
                                                        )})${nl}`;
                                                }
                                            }
                                        }
                                    )
                                );

                                if (buildName.includes('_rerun')) {
                                    failedTestSummary[
                                        buildName
                                    ] += `${nl}</details>${nl}${nl}`;
                                }
                            } else {
                                failedBuildSummary[buildName] = buildInfo;
                                failedBuildSummary[buildName] += buildResultStr;
                            }
                        }
                    )
                );

                if (failedBuildSummary || failedTestSummary) {
                    Object.keys(failedBuildSummary)
                        .sort()
                        .forEach((buildName) => {
                            report += failedBuildSummary[buildName];
                        });

                    report += `${nl} --- ${nl}`;
                    Object.keys(failedTestSummary)
                        .sort()
                        .forEach((buildName) => {
                            report += failedTestSummary[buildName];
                        });
                } else {
                    report += 'Congratulation! There is no failure!';
                }
            } else {
                report = `Cannot find the build information (${parentId}) in Database!`;
            }

            setBody(report);
        };

        updateData();
    }, [parentId]);

    const copyCodeToClipboard = () => {
        const markdownText = document.getElementById('markdown-text');
        let range, selection;

        if (document.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(markdownText);
            range.select();
        } else if (window.getSelection) {
            selection = window.getSelection();
            range = document.createRange();
            range.selectNodeContents(markdownText);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        let alert;
        if (document.execCommand('Copy')) {
            alert = (
                <Alert
                    message="Successfully copied to clipboard"
                    type="success"
                    showIcon
                />
            );
        } else {
            alert = (
                <Alert
                    message="Failed to copy to clipboard"
                    type="error"
                    showIcon
                />
            );
        }
        ReactDOM.render(alert, document.getElementById('copy-status'));
    };

    const title = 'Release Summary Report for ' + buildName;
    return (
        <div>
            <TestBreadcrumb buildId={parentId} />
            <div id="copy-status"></div>
            <Card
                title={title}
                bordered={true}
                style={{ width: '100%' }}
                extra={
                    <Tooltip
                        title="Copy markdown report to clipboard"
                        placement="topRight"
                    >
                        <CopyOutlined
                            id="copy-button"
                            style={{ fontSize: '200%' }}
                            onClick={() => copyCodeToClipboard()}
                        />
                    </Tooltip>
                }
            >
                <pre className="card-body" id="markdown-text">
                    {body}
                </pre>
            </Card>
        </div>
    );
};

export default ReleaseSummary;
